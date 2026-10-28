import requests
import urllib.parse
import sys

BASE_URL = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
PASSWORD = "Ts-5alRJbooOoboi0aM"

# Cache sessions per user to avoid multiple logins
_SESSIONS = {}

def get_authenticated_session(email):
    if email in _SESSIONS:
        return _SESSIONS[email]

    session = requests.Session()
    try:
        r = session.get(CSRF_URL, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Failed to GET CSRF cookie: {e}")

    if r.status_code not in (200, 204):
        raise AssertionError(f"Unexpected status from CSRF cookie endpoint: {r.status_code}, body: {r.text}")

    xsrf_cookie = session.cookies.get("XSRF-TOKEN")
    if not xsrf_cookie:
        raise AssertionError("XSRF-TOKEN cookie not found after CSRF initialization")

    xsrf_token = urllib.parse.unquote(xsrf_cookie)
    headers = {
        "X-XSRF-TOKEN": xsrf_token,
        "Origin": "http://localhost:8080",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    login_url = f"{BASE_URL}/auth/login"
    payload = {"email": email, "password": PASSWORD}
    try:
        resp = session.post(login_url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Login request failed for {email}: {e}")

    if resp.status_code != 200:
        raise AssertionError(f"Login failed for {email}: status {resp.status_code}, body: {resp.text}")

    _SESSIONS[email] = session
    return session

def test_list_assignees_by_lead_type_with_permission():
    # Case 1: Successful request with manage permission (secretaria for general contacts)
    secretaria = get_authenticated_session("secretaria@pibls.test")
    url = f"{BASE_URL}/admin/leads/assignees"
    try:
        r = secretaria.get(url, params={"type": "CONTATO"}, headers={"Accept": "application/json"}, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Request failed for secretaria: {e}")
    assert r.status_code == 200, f"Expected 200 for secretaria GET assignees?type=CONTATO, got {r.status_code}, body: {r.text}"
    try:
        j = r.json()
    except ValueError:
        raise AssertionError("Response from secretaria is not valid JSON")
    assert isinstance(j, dict) and "data" in j and isinstance(j["data"], list), f"Expected JSON with data list, got: {j}"
    for item in j["data"]:
        assert isinstance(item, dict) and "id" in item and "name" in item, f"Assignee item missing id or name: {item}"

    # Case 2: Missing type parameter returns 422
    try:
        r2 = secretaria.get(url, headers={"Accept": "application/json"}, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Request failed for secretaria (missing type): {e}")
    assert r2.status_code == 422, f"Expected 422 when missing type param, got {r2.status_code}, body: {r2.text}"

    # Case 3: Insufficient permissions return 403 (comunicacao has no contact permission)
    comunicacao = get_authenticated_session("comunicacao@pibls.test")
    try:
        r3 = comunicacao.get(url, params={"type": "CONTATO"}, headers={"Accept": "application/json"}, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Request failed for comunicacao: {e}")
    assert r3.status_code == 403, f"Expected 403 for comunicacao GET assignees?type=CONTATO, got {r3.status_code}, body: {r3.text}"

if __name__ == "__main__":
    try:
        test_list_assignees_by_lead_type_with_permission()
    except AssertionError as e:
        print("TEST FAILED:", e)
        sys.exit(1)
    print("TEST PASSED")