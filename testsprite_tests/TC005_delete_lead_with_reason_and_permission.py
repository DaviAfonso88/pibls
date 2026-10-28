import requests
import time
import urllib.parse
from requests.exceptions import ProxyError, ConnectionError

BASE_API = "http://localhost:8080/api"
BASE_ROOT = "http://localhost:8080"
TIMEOUT = 120  # seconds for each request
RETRY_ATTEMPTS = 4
RETRY_SLEEP = 5
MAX_LOGIN_ATTEMPTS = 3


def request_with_retries(session, method, url, **kwargs):
    attempts = 0
    while True:
        try:
            resp = session.request(method, url, timeout=TIMEOUT, **kwargs)
            return resp
        except (ProxyError, ConnectionError) as e:
            attempts += 1
            if attempts >= RETRY_ATTEMPTS:
                raise
            time.sleep(RETRY_SLEEP)


def get_csrf_token(session):
    # GET the CSRF cookie (outside /api)
    url = f"{BASE_ROOT}/sanctum/csrf-cookie"
    resp = request_with_retries(session, "GET", url, headers={"Accept": "application/json"})
    if resp.status_code != 204:
        raise AssertionError(f"Expected 204 from csrf-cookie, got {resp.status_code}, body: {resp.text}")
    raw = session.cookies.get("XSRF-TOKEN")
    if not raw:
        raise AssertionError("XSRF-TOKEN cookie not found after csrf-cookie request")
    return urllib.parse.unquote(raw)


def login(session, email, password):
    last_exc = None
    for attempt in range(MAX_LOGIN_ATTEMPTS):
        try:
            token = get_csrf_token(session)
            url = f"{BASE_API}/auth/login"
            headers = {
                "X-XSRF-TOKEN": token,
                "Origin": BASE_ROOT,
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
            resp = request_with_retries(session, "POST", url, json={"email": email, "password": password}, headers=headers)
            if resp.status_code == 200:
                # Refresh the CSRF token after successful login to ensure we use the server's current token
                return get_csrf_token(session)
            else:
                # treat as failed login attempt
                last_exc = AssertionError(f"Login failed for {email}: status {resp.status_code}, body: {resp.text}")
        except (ProxyError, ConnectionError) as e:
            last_exc = e
            time.sleep(RETRY_SLEEP)
    if last_exc:
        raise last_exc
    raise AssertionError("Login failed for unknown reasons")


def find_leads(session, token, inbox):
    url = f"{BASE_API}/admin/leads"
    headers = {
        "X-XSRF-TOKEN": token,
        "Origin": BASE_ROOT,
        "Accept": "application/json",
    }
    resp = request_with_retries(session, "GET", url, params={"inbox": inbox}, headers=headers)
    if resp.status_code != 200:
        raise AssertionError(f"Expected 200 listing leads for inbox={inbox}, got {resp.status_code}, body: {resp.text}")
    body = resp.json()
    if "data" not in body:
        raise AssertionError(f"Leads list response missing data: {body}")
    return body["data"]


def get_lead_detail(session, token, lead_id, expected_statuses=(200, 404)):
    url = f"{BASE_API}/admin/leads/{lead_id}"
    headers = {
        "X-XSRF-TOKEN": token,
        "Origin": BASE_ROOT,
        "Accept": "application/json",
    }
    resp = request_with_retries(session, "GET", url, headers=headers)
    if resp.status_code not in expected_statuses:
        raise AssertionError(f"GET lead {lead_id} returned unexpected status {resp.status_code}, body: {resp.text}")
    return resp


def delete_lead(session, token, lead_id, reason=None):
    url = f"{BASE_API}/admin/leads/{lead_id}"
    headers = {
        "X-XSRF-TOKEN": token,
        "Origin": BASE_ROOT,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    json_body = None
    if reason is not None:
        json_body = {"reason": reason}
    # Use request_with_retries to handle flaky network. If a response is returned, we won't retry on status codes.
    resp = request_with_retries(session, "DELETE", url, headers=headers, json=json_body)
    return resp


def test_delete_lead_with_reason_and_permission():
    password = "Ts-5alRJbooOoboi0aM"

    # 1) Login as secretaria and fetch leads in geral
    secretaria_sess = requests.Session()
    secretaria_token = login(secretaria_sess, "secretaria@pibls.test", password)

    leads = find_leads(secretaria_sess, secretaria_token, "geral")
    # Find Carla Teste Gama
    carla = None
    other = None
    for l in leads:
        name = l.get("name")
        if name == "Carla Teste Gama":
            carla = l
        elif other is None and name is not None and name != "Carla Teste Gama":
            other = l
    assert carla is not None, "Required lead 'Carla Teste Gama' not found in geral inbox; cannot perform destructive test."
    assert other is not None, "No suitable non-Carla lead found for non-destructive checks."

    carla_id = carla["id"]
    other_id = other["id"]

    # 2) Missing reason returns 422 when using secretaria on a non-deleted contact (other)
    resp_missing_reason = delete_lead(secretaria_sess, secretaria_token, other_id, reason=None)
    assert resp_missing_reason.status_code == 422, f"Expected 422 for missing reason, got {resp_missing_reason.status_code}, body: {resp_missing_reason.text}"
    # Validate error payload shape
    err_body = resp_missing_reason.json()
    assert "error" in err_body and isinstance(err_body["error"], dict), f"Missing reason error shape unexpected: {err_body}"

    # Ensure the other contact still exists
    get_other_after = get_lead_detail(secretaria_sess, secretaria_token, other_id, expected_statuses=(200, 404))
    assert get_other_after.status_code == 200, f"Other lead should still exist after missing-reason attempt; got {get_other_after.status_code}"

    # 3) Insufficient permissions (403) using pastoral on a contact that must NOT be deleted (other)
    pastoral_sess = requests.Session()
    pastoral_token = login(pastoral_sess, "pastoral@pibls.test", password)
    # Confirm pastoral can GET the lead (reads) - if not readable, the system would return 404 which violates the test precondition
    pastoral_get = get_lead_detail(pastoral_sess, pastoral_token, other_id, expected_statuses=(200, 404))
    assert pastoral_get.status_code == 200, f"Pastoral user cannot read the lead used for 403 test; expected 200, got {pastoral_get.status_code}"

    # Attempt delete with reason as pastoral -> expect 403 and no deletion
    resp_forbidden = delete_lead(pastoral_sess, pastoral_token, other_id, reason="TITULAR_REQUEST")
    assert resp_forbidden.status_code == 403, f"Expected 403 for pastoral delete attempt, got {resp_forbidden.status_code}, body: {resp_forbidden.text}"
    # Validate error payload shape
    body_403 = resp_forbidden.json()
    assert "error" in body_403 and isinstance(body_403["error"], dict), f"403 error shape unexpected: {body_403}"

    # Ensure the other contact still exists after forbidden attempt
    get_other_after_403 = get_lead_detail(secretaria_sess, secretaria_token, other_id, expected_statuses=(200, 404))
    assert get_other_after_403.status_code == 200, f"Other lead should still exist after forbidden delete attempt; got {get_other_after_403.status_code}"

    # 4) Deleting non-existent lead returns 404
    resp_nonexistent = delete_lead(secretaria_sess, secretaria_token, 99999999, reason="TITULAR_REQUEST")
    assert resp_nonexistent.status_code == 404, f"Expected 404 when deleting non-existent id, got {resp_nonexistent.status_code}, body: {resp_nonexistent.text}"

    # 5) Successful delete of Carla by secretaria -> 204 and subsequent GET returns 404
    resp_delete_carla = delete_lead(secretaria_sess, secretaria_token, carla_id, reason="TITULAR_REQUEST")
    assert resp_delete_carla.status_code == 204, f"Expected 204 on successful delete of Carla, got {resp_delete_carla.status_code}, body: {resp_delete_carla.text}"

    # After successful deletion, GET should return 404
    get_after_delete = get_lead_detail(secretaria_sess, secretaria_token, carla_id, expected_statuses=(200, 404))
    assert get_after_delete.status_code == 404, f"Expected 404 after deletion of Carla, got {get_after_delete.status_code}, body: {get_after_delete.text}"

    print("TC005 passed: delete_lead_with_reason_and_permission")


if __name__ == "__main__":
    test_delete_lead_with_reason_and_permission()
