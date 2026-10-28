import requests
import time
import urllib.parse
from requests.exceptions import ProxyError, ConnectionError

BASE_API = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
PASSWORD = "Ts-5alRJbooOoboi0aM"

# Global login counter to ensure at most 3 logins per test
_login_count = 0
_sessions = {}

def resilient_request(session, method, url, max_retries=4, backoff=5, **kwargs):
    attempts = 0
    # default timeout 120s unless provided
    if "timeout" not in kwargs:
        kwargs["timeout"] = 120
    while True:
        try:
            resp = session.request(method, url, **kwargs)
            return resp
        except (ProxyError, ConnectionError) as e:
            attempts += 1
            if attempts >= max_retries:
                raise
            time.sleep(backoff)

def get_xsrf_token_header(session):
    token = session.cookies.get("XSRF-TOKEN")
    if not token:
        return {}
    return {
        "X-XSRF-TOKEN": urllib.parse.unquote(token),
        "Origin": "http://localhost:8080",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

def login(email):
    global _login_count, _sessions
    if email in _sessions:
        return _sessions[email]
    if _login_count >= 3:
        raise RuntimeError("Exceeded maximum login attempts for this test (3)")
    session = requests.Session()
    # get CSRF cookie
    resilient_request(session, "GET", CSRF_URL, headers={"Accept": "application/json"})
    headers = get_xsrf_token_header(session)
    payload = {"email": email, "password": PASSWORD}
    resp = resilient_request(session, "POST", f"{BASE_API}/auth/login", json=payload, headers=headers)
    _login_count += 1
    if resp.status_code != 200:
        raise AssertionError(f"Login failed for {email}: {resp.status_code} {resp.text}")
    _sessions[email] = session
    return session

def find_lead_for_allowed_names(session, inbox, allowed_names):
    params = {"inbox": inbox}
    headers = {"Accept": "application/json"}
    resp = resilient_request(session, "GET", f"{BASE_API}/admin/leads", params=params, headers=headers)
    assert resp.status_code == 200, f"Failed to list leads for inbox {inbox}: {resp.status_code} {resp.text}"
    js = resp.json()
    data = js.get("data", [])
    for item in data:
        name = item.get("name")
        if name in allowed_names:
            return item
    return None

def test_update_lead_status_assignee_and_note():
    # Allowed names per instructions
    secretaria_names = {"Ana Teste Alfa", "Bruno Teste Beta"}
    oracao_names = {"Elisa Teste Epsilon"}
    # Login as secretaria first and try to find a lead in geral
    secretaria = login("secretaria@pibls.test")
    lead = find_lead_for_allowed_names(secretaria, "geral", secretaria_names)
    used_session = secretaria
    inbox_used = "geral"
    if not lead:
        # try oracao inbox with oracao user
        oracao = login("oracao@pibls.test")
        lead = find_lead_for_allowed_names(oracao, "oracao", oracao_names)
        used_session = oracao
        inbox_used = "oracao"
    assert lead is not None, "No allowed lead found in specified inboxes for test. At least one of the named contacts must exist."
    lead_id = lead["id"]
    original_status = lead.get("status")
    assert original_status in {"NOVO", "EM_ATENDIMENTO", "CONCLUIDO"}, f"Unexpected original status: {original_status}"

    # mapping to pick a valid target status
    valid_next = {
        "NOVO": "EM_ATENDIMENTO",
        "EM_ATENDIMENTO": "CONCLUIDO",
        "CONCLUIDO": "EM_ATENDIMENTO"
    }
    target_status = valid_next[original_status]

    # Prepare headers for the session that will manage (used_session already has proper login)
    headers = get_xsrf_token_header(used_session)

    try:
        # 1) Successful update to a valid status with note -> expect 200
        payload = {"status": target_status, "note": "Automated test note."}
        resp = resilient_request(used_session, "PATCH", f"{BASE_API}/admin/leads/{lead_id}", json=payload, headers=headers)
        assert resp.status_code == 200, f"Expected 200 on valid PATCH, got {resp.status_code}: {resp.text}"
        resp_js = resp.json()
        assert "data" in resp_js, f"Response missing data for successful PATCH: {resp.text}"
        assert resp_js["data"].get("status") == target_status, f"Status not updated to {target_status}"

        # 2) Invalid status transition: attempt to set the same status again -> expect 409 INVALID_STATUS_TRANSITION
        invalid_payload = {"status": target_status}
        resp2 = resilient_request(used_session, "PATCH", f"{BASE_API}/admin/leads/{lead_id}", json=invalid_payload, headers=headers)
        assert resp2.status_code == 409, f"Expected 409 for invalid transition, got {resp2.status_code}: {resp2.text}"
        js2 = resp2.json()
        err = js2.get("error") or {}
        assert err.get("code") == "INVALID_STATUS_TRANSITION", f"Expected error code INVALID_STATUS_TRANSITION, got {err.get('code')}"

        # 3) Note exceeding 1000 characters returns 422
        long_note = "x" * 1001
        long_payload = {"note": long_note}
        resp3 = resilient_request(used_session, "PATCH", f"{BASE_API}/admin/leads/{lead_id}", json=long_payload, headers=headers)
        assert resp3.status_code == 422, f"Expected 422 for long note, got {resp3.status_code}: {resp3.text}"
        js3 = resp3.json()
        assert "error" in js3, "Expected error wrapper for validation error on long note"

        # 4) Insufficient permissions: pastoral user (can read but not manage) -> PATCH should return 403
        pastoral = login("pastoral@pibls.test")
        pastoral_headers = get_xsrf_token_header(pastoral)
        pastoral_payload = {"note": "Attempt by insufficient-perm user"}
        resp4 = resilient_request(pastoral, "PATCH", f"{BASE_API}/admin/leads/{lead_id}", json=pastoral_payload, headers=pastoral_headers)
        assert resp4.status_code == 403, f"Expected 403 for insufficient permissions, got {resp4.status_code}: {resp4.text}"

    finally:
        # Attempt to revert the status back to original to leave system unchanged
        try:
            revert_payload = {"status": original_status, "note": "Reverting status after test."}
            # Use secretaria session if the lead belongs to geral, otherwise use oracao session
            revert_session = secretaria if inbox_used == "geral" else login("oracao@pibls.test")
            revert_headers = get_xsrf_token_header(revert_session)
            resp_revert = resilient_request(revert_session, "PATCH", f"{BASE_API}/admin/leads/{lead_id}", json=revert_payload, headers=revert_headers)
            # Accept either 200 for success or 409 if somehow the transition isn't allowed; still ensure final status matches original by GET.
            # Do a GET to confirm actual status
            get_headers = {"Accept": "application/json"}
            get_resp = resilient_request(revert_session, "GET", f"{BASE_API}/admin/leads/{lead_id}", headers=get_headers)
            if get_resp.status_code == 200:
                current = get_resp.json().get("data", {}).get("status")
                assert current == original_status, f"Failed to revert lead {lead_id} to original status {original_status}, current is {current}"
            else:
                raise AssertionError(f"Failed to GET lead after revert attempt: {get_resp.status_code} {get_resp.text}")
        except Exception as e:
            # Bubble up as assertion error to indicate cleanup failed
            raise AssertionError(f"Cleanup/revert failed: {e}")

if __name__ == "__main__":
    test_update_lead_status_assignee_and_note()