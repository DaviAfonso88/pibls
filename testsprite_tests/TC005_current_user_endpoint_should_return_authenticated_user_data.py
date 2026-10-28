import requests
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
BASE_SITE = "http://localhost:8080"
CSRF_ENDPOINT = BASE_SITE + "/sanctum/csrf-cookie"
LOGIN_ENDPOINT = BASE_API + "/auth/login"
ME_ENDPOINT = BASE_API + "/auth/me"
LOGOUT_ENDPOINT = BASE_API + "/auth/logout"
TIMEOUT = 30

def test_current_user_endpoint_should_return_authenticated_user_data():
    session = requests.Session()
    email = "admin@pibls.test"
    password = "Ts-v19iCHBnY5NYweUT"

    try:
        # Get CSRF cookie
        resp = session.get(CSRF_ENDPOINT, timeout=TIMEOUT)
        assert resp.status_code == 204, f"Expected 204 from csrf-cookie, got {resp.status_code}: {resp.text}"

        xsrf_cookie = session.cookies.get("XSRF-TOKEN")
        assert xsrf_cookie is not None, "XSRF-TOKEN cookie not found after csrf-cookie request"
        xsrf_token = urllib.parse.unquote(xsrf_cookie)

        # Prepare headers for login
        headers = {
            "X-XSRF-TOKEN": xsrf_token,
            "Origin": BASE_SITE,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # Login
        payload = {"email": email, "password": password}
        resp = session.post(LOGIN_ENDPOINT, json=payload, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Login expected 200, got {resp.status_code}: {resp.text}"

        resp_json = resp.json()
        assert isinstance(resp_json, dict) and "data" in resp_json, f"Login response JSON missing 'data': {resp_json}"
        login_data = resp_json["data"]

        # Validate structure of returned user data from login
        for key in ("id", "name", "email", "ministry", "roles", "permissions"):
            assert key in login_data, f"Key '{key}' missing from login data: {login_data}"
        assert isinstance(login_data["id"], int) or isinstance(login_data["id"], str), "id should be int or string"
        assert isinstance(login_data["name"], str), "name should be a string"
        assert isinstance(login_data["email"], str), "email should be a string"
        assert login_data["email"].lower() == email.lower(), f"Returned email {login_data['email']} does not match {email}"
        assert (login_data["ministry"] is None) or isinstance(login_data["ministry"], dict), "ministry should be null or an object"
        assert isinstance(login_data["roles"], list), "roles should be a list"
        assert isinstance(login_data["permissions"], list), "permissions should be a list"
        assert "password" not in login_data, "Response should not include password field in user data"

        # GET current user using session
        resp = session.get(ME_ENDPOINT, timeout=TIMEOUT, headers={"Accept": "application/json"})
        assert resp.status_code == 200, f"GET /auth/me expected 200, got {resp.status_code}: {resp.text}"
        me_json = resp.json()
        assert isinstance(me_json, dict) and "data" in me_json, f"/auth/me response JSON missing 'data': {me_json}"
        me_data = me_json["data"]

        # Validate same keys and values as login
        for key in ("id", "name", "email", "ministry", "roles", "permissions"):
            assert key in me_data, f"Key '{key}' missing from /auth/me data: {me_data}"
        assert str(me_data["id"]) == str(login_data["id"]), f"id mismatch between login and /me: {login_data['id']} != {me_data['id']}"
        assert me_data["email"].lower() == login_data["email"].lower(), f"email mismatch between login and /me: {login_data['email']} != {me_data['email']}"
        assert me_data["name"] == login_data["name"], f"name mismatch between login and /me: {login_data['name']} != {me_data['name']}"
        assert (me_data["ministry"] is None) == (login_data["ministry"] is None) or isinstance(me_data["ministry"], dict), "ministry shape mismatch"
        assert isinstance(me_data["roles"], list), "roles should be a list in /auth/me"
        assert isinstance(me_data["permissions"], list), "permissions should be a list in /auth/me"
        assert "password" not in me_data, "/auth/me response should not include password field"

        print("TEST PASSED: current_user_endpoint_should_return_authenticated_user_data")
    except requests.RequestException as e:
        raise AssertionError(f"Network error during test: {e}") from e
    finally:
        # Attempt to logout to clean up session if possible
        try:
            # Refresh CSRF token before logout
            r = session.get(CSRF_ENDPOINT, timeout=TIMEOUT)
            if r.status_code == 204:
                xsrf_cookie = session.cookies.get("XSRF-TOKEN")
                if xsrf_cookie:
                    xsrf_token = urllib.parse.unquote(xsrf_cookie)
                    headers = {
                        "X-XSRF-TOKEN": xsrf_token,
                        "Origin": BASE_SITE,
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    }
                    logout_resp = session.post(LOGOUT_ENDPOINT, headers=headers, timeout=TIMEOUT)
                    # Accept 204 or 200 depending on implementation; do not fail test on logout issues
                    if logout_resp.status_code not in (200, 204):
                        # best-effort warning
                        sys.stderr.write(f"Warning: logout returned {logout_resp.status_code}: {logout_resp.text}\n")
        except Exception:
            # ignore cleanup errors
            pass

if __name__ == "__main__":
    test_current_user_endpoint_should_return_authenticated_user_data()