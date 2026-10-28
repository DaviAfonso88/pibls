import requests
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
TIMEOUT = 30.0

def test_login_endpoint_should_authenticate_user_and_set_session_cookie():
    """
    TC002: Verify that POST /api/auth/login with valid email and password and correct X-XSRF-TOKEN
    header returns HTTP 200 with user data and sets the session cookie.
    """
    session = requests.Session()
    try:
        # 1) Acquire CSRF cookie (must be done outside /api)
        resp = session.get(CSRF_URL, timeout=TIMEOUT)
        assert resp.status_code == 204, f"Expected 204 from CSRF endpoint, got {resp.status_code}, body: {resp.text}"

        # 2) Extract and URL-decode XSRF-TOKEN cookie value
        xsrf_cookie = session.cookies.get("XSRF-TOKEN")
        assert xsrf_cookie is not None and xsrf_cookie != "", "Missing XSRF-TOKEN cookie after CSRF request"
        xsrf_value = urllib.parse.unquote(xsrf_cookie)

        # 3) Prepare headers for POST /api/auth/login
        headers = {
            "X-XSRF-TOKEN": xsrf_value,
            "Origin": "http://localhost:8080",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # 4) Use a seeded test user (login at most once per user in a test run)
        email = "admin@pibls.test"
        password = "Ts-v19iCHBnY5NYweUT"
        payload = {"email": email, "password": password}

        login_url = f"{BASE_API}/auth/login"
        login_resp = session.post(login_url, json=payload, headers=headers, timeout=TIMEOUT)

        # Validate HTTP status
        assert login_resp.status_code == 200, f"Expected 200 on successful login, got {login_resp.status_code}, body: {login_resp.text}"

        # Validate JSON structure
        try:
            body = login_resp.json()
        except ValueError as e:
            raise AssertionError(f"Login response is not valid JSON: {e}; body: {login_resp.text}")

        assert isinstance(body, dict), f"Login response JSON is not an object: {body}"
        assert "data" in body and isinstance(body["data"], dict), f"Login response missing 'data' object: {body}"

        data = body["data"]
        # Required fields per PRD: id, name, email, ministry (object or null), roles (list), permissions (list)
        for field in ("id", "name", "email", "roles", "permissions"):
            assert field in data, f"Missing '{field}' in login data: {data}"
        assert data["email"] == email, f"Returned email mismatch: expected {email}, got {data.get('email')}"

        # ministry may be null or object
        assert "ministry" in data, f"Missing 'ministry' in login data: {data}"

        # roles and permissions should be lists
        assert isinstance(data["roles"], list), f"'roles' is not a list: {data['roles']}"
        assert isinstance(data["permissions"], list), f"'permissions' is not a list: {data['permissions']}"

        # 5) Ensure session cookie was set (pibls_session)
        session_cookie = session.cookies.get("pibls_session")
        assert session_cookie is not None and session_cookie != "", f"Session cookie 'pibls_session' was not set after login. Cookies: {session.cookies.get_dict()}"

        print("TC002 passed: login returned 200, user data present, and session cookie set.")

    finally:
        # Best-effort cleanup: attempt logout if session cookie exists to avoid leaving sessions open
        try:
            if session.cookies.get("pibls_session"):
                # Acquire fresh CSRF token before logout (some setups may require it)
                try:
                    session.get(CSRF_URL, timeout=TIMEOUT)
                except Exception:
                    pass
                logout_url = f"{BASE_API}/auth/logout"
                # Extract possibly-updated XSRF-TOKEN
                xsrf_cookie = session.cookies.get("XSRF-TOKEN") or ""
                xsrf_value = urllib.parse.unquote(xsrf_cookie) if xsrf_cookie else ""
                headers = {
                    "X-XSRF-TOKEN": xsrf_value,
                    "Origin": "http://localhost:8080",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                }
                try:
                    session.post(logout_url, headers=headers, timeout=TIMEOUT)
                except Exception:
                    pass
        finally:
            session.close()

if __name__ == "__main__":
    try:
        test_login_endpoint_should_authenticate_user_and_set_session_cookie()
    except AssertionError as e:
        print(f"TEST FAILED: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}", file=sys.stderr)
        sys.exit(2)
    else:
        sys.exit(0)