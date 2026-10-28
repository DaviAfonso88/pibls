import time
import requests
from requests.exceptions import ProxyError, ConnectionError, RequestException
from urllib.parse import unquote

BASE = "http://localhost:8080"
API_BASE = BASE + "/api"
TIMEOUT = 120  # seconds for each request
RETRY_ATTEMPTS = 4
RETRY_SLEEP = 5

LOGIN_PASSWORD = "Ts-5alRJbooOoboi0aM"

_login_cache = {}
_login_count = 0


def request_with_retries(session: requests.Session, method: str, url: str, **kwargs):
    attempts = 0
    while True:
        try:
            kwargs.setdefault("timeout", TIMEOUT)
            resp = session.request(method, url, **kwargs)
            return resp
        except (ProxyError, ConnectionError) as e:
            attempts += 1
            if attempts >= RETRY_ATTEMPTS:
                raise
            time.sleep(RETRY_SLEEP)


def login(email: str, password: str) -> requests.Session:
    global _login_count
    if email in _login_cache:
        return _login_cache[email]
    if _login_count >= 3:
        raise RuntimeError("Exceeded maximum login attempts (3)")
    sess = requests.Session()
    # Get CSRF cookie
    csrf_url = f"{BASE}/sanctum/csrf-cookie"
    resp = request_with_retries(sess, "GET", csrf_url, headers={"Accept": "application/json"})
    if resp.status_code not in (200, 204):
        raise RuntimeError(f"Failed to get CSRF cookie: {resp.status_code} {resp.text}")
    # Prepare X-XSRF-TOKEN header value (URL-decoded)
    xsrf = sess.cookies.get("XSRF-TOKEN", "")
    xsrf_decoded = unquote(xsrf)
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": BASE,
        "X-XSRF-TOKEN": xsrf_decoded,
    }
    login_url = f"{API_BASE}/auth/login"
    payload = {"email": email, "password": password}
    resp = request_with_retries(sess, "POST", login_url, json=payload, headers=headers)
    if resp.status_code != 200:
        raise RuntimeError(f"Login failed for {email}: {resp.status_code} {resp.text}")
    _login_cache[email] = sess
    _login_count += 1
    return sess


def test_get_lead_detail_with_permission_checks():
    # Log in users
    secretaria_email = "secretaria@pibls.test"
    oracao_email = "oracao@pibls.test"

    secretaria_sess = login(secretaria_email, LOGIN_PASSWORD)
    oracao_sess = login(oracao_email, LOGIN_PASSWORD)

    # Helper headers for authenticated GETs
    common_headers = {"Accept": "application/json", "Origin": BASE}

    # 1) List geral inbox as secretaria and pick a non-ORACAO lead id
    geral_list_url = f"{API_BASE}/admin/leads?inbox=geral"
    resp = request_with_retries(secretaria_sess, "GET", geral_list_url, headers=common_headers)
    assert resp.status_code == 200, f"Expected 200 from geral list, got {resp.status_code}: {resp.text}"
    geral_json = resp.json()
    assert "data" in geral_json and isinstance(geral_json["data"], list), "geral list response missing data array"
    geral_id = None
    geral_type = None
    for item in geral_json["data"]:
        t = item.get("type")
        if t != "ORACAO":
            geral_id = item.get("id")
            geral_type = t
            break
    assert geral_id is not None, "No non-ORACAO lead found in geral inbox for secretaria to test"

    # 2) List oracao inbox as oracao user and pick a lead id
    oracao_list_url = f"{API_BASE}/admin/leads?inbox=oracao"
    resp = request_with_retries(oracao_sess, "GET", oracao_list_url, headers=common_headers)
    assert resp.status_code == 200, f"Expected 200 from oracao list, got {resp.status_code}: {resp.text}"
    oracao_json = resp.json()
    assert "data" in oracao_json and isinstance(oracao_json["data"], list), "oracao list response missing data array"
    oracao_id = None
    oracao_type = None
    if len(oracao_json["data"]) > 0:
        item = oracao_json["data"][0]
        oracao_id = item.get("id")
        oracao_type = item.get("type")
    assert oracao_id is not None, "No ORACAO lead found in oracao inbox for oracao user to test"

    # 3) GET detail for geral lead as secretaria (authorized) -> expect 200 and full details
    geral_detail_url = f"{API_BASE}/admin/leads/{geral_id}"
    resp = request_with_retries(secretaria_sess, "GET", geral_detail_url, headers=common_headers)
    assert resp.status_code == 200, f"Expected 200 for geral lead detail as secretaria, got {resp.status_code}: {resp.text}"
    data = resp.json().get("data")
    assert data is not None and isinstance(data, dict), "Expected data object in geral detail response"
    assert data.get("id") == geral_id, "Returned geral lead id does not match requested id"
    # Check decrypted message and activities presence
    assert "message" in data, "Expected 'message' field in geral lead detail"
    # message can be empty but should exist (decryption included)
    assert "activities" in data and isinstance(data["activities"], list), "Expected 'activities' list in geral lead detail"

    # 4) GET detail for oracao lead as oracao (authorized) -> expect 200 and full details
    oracao_detail_url = f"{API_BASE}/admin/leads/{oracao_id}"
    resp = request_with_retries(oracao_sess, "GET", oracao_detail_url, headers=common_headers)
    assert resp.status_code == 200, f"Expected 200 for oracao lead detail as oracao, got {resp.status_code}: {resp.text}"
    data = resp.json().get("data")
    assert data is not None and isinstance(data, dict), "Expected data object in oracao detail response"
    assert data.get("id") == oracao_id, "Returned oracao lead id does not match requested id"
    assert "message" in data, "Expected 'message' field in oracao lead detail"
    assert "activities" in data and isinstance(data["activities"], list), "Expected 'activities' list in oracao lead detail"

    # 5) Unauthorized access checks:
    # a) secretaria tries to GET oracao lead -> should be 404 and match missing id 404 for secretaria
    resp_unauth = request_with_retries(secretaria_sess, "GET", oracao_detail_url, headers=common_headers)
    assert resp_unauth.status_code == 404, f"Expected 404 when secretaria requests oracao lead, got {resp_unauth.status_code}: {resp_unauth.text}"
    try:
        unauth_json = resp_unauth.json()
    except ValueError:
        raise AssertionError("Unauthorized (secretaria->oracao) response is not valid JSON")
    assert "error" in unauth_json and isinstance(unauth_json["error"], dict), "Unauthorized response missing error object"

    # missing id for secretaria
    missing_id = 999999999
    missing_url = f"{API_BASE}/admin/leads/{missing_id}"
    resp_missing = request_with_retries(secretaria_sess, "GET", missing_url, headers=common_headers)
    assert resp_missing.status_code == 404, f"Expected 404 for missing id as secretaria, got {resp_missing.status_code}: {resp_missing.text}"
    try:
        missing_json = resp_missing.json()
    except ValueError:
        raise AssertionError("Missing-id response is not valid JSON")
    assert "error" in missing_json and isinstance(missing_json["error"], dict), "Missing-id response missing error object"

    # Compare only status, error.code and error.message as required
    assert unauth_json["error"].get("code") == missing_json["error"].get("code"), "Unauthorized vs missing error.code differ"
    assert unauth_json["error"].get("message") == missing_json["error"].get("message"), "Unauthorized vs missing error.message differ"

    # b) oracao tries to GET geral lead -> should be 404 and match missing id 404 for oracao
    resp_unauth2 = request_with_retries(oracao_sess, "GET", geral_detail_url, headers=common_headers)
    assert resp_unauth2.status_code == 404, f"Expected 404 when oracao requests geral lead, got {resp_unauth2.status_code}: {resp_unauth2.text}"
    try:
        unauth2_json = resp_unauth2.json()
    except ValueError:
        raise AssertionError("Unauthorized (oracao->geral) response is not valid JSON")
    assert "error" in unauth2_json and isinstance(unauth2_json["error"], dict), "Unauthorized response missing error object"

    # missing id for oracao
    resp_missing2 = request_with_retries(oracao_sess, "GET", missing_url, headers=common_headers)
    assert resp_missing2.status_code == 404, f"Expected 404 for missing id as oracao, got {resp_missing2.status_code}: {resp_missing2.text}"
    try:
        missing2_json = resp_missing2.json()
    except ValueError:
        raise AssertionError("Missing-id response (oracao) is not valid JSON")
    assert "error" in missing2_json and isinstance(missing2_json["error"], dict), "Missing-id response missing error object"

    # Compare only status, error.code and error.message
    assert unauth2_json["error"].get("code") == missing2_json["error"].get("code"), "Unauthorized (oracao->geral) vs missing error.code differ"
    assert unauth2_json["error"].get("message") == missing2_json["error"].get("message"), "Unauthorized (oracao->geral) vs missing error.message differ"

    print("TC003 passed: get_lead_detail_with_permission_checks")


if __name__ == "__main__":
    test_get_lead_detail_with_permission_checks()