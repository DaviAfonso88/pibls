import requests
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
LOGIN_URL = f"{BASE_API}/auth/login"
ADMIN_USERS_URL = f"{BASE_API}/admin/users"
LOGOUT_URL = f"{BASE_API}/auth/logout"
TIMEOUT = 30.0

def test_admin_users_endpoint_should_return_403_without_permission():
    """
    TC008 - Verify that GET /api/admin/users with a valid session but without users.read
    permission returns HTTP 403 with the appropriate forbidden message.
    """
    email = "secretaria@pibls.test"
    password = "Ts-v19iCHBnY5NYweUT"

    session = requests.Session()
    logged_in = False

    try:
        # 1) Obtain CSRF cookie
        try:
            r = session.get(CSRF_URL, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Failed to GET CSRF cookie: {e}")
        assert r.status_code == 204, f"Expected 204 from CSRF endpoint, got {r.status_code}"

        xsrf_cookie = session.cookies.get("XSRF-TOKEN")
        assert xsrf_cookie, "XSRF-TOKEN cookie not set after CSRF call"
        xsrf_token = urllib.parse.unquote(xsrf_cookie)

        # 2) Login with seeded user that does NOT have users.read permission
        login_headers = {
            "X-XSRF-TOKEN": xsrf_token,
            "Origin": "http://localhost:8080",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        login_payload = {"email": email, "password": password}

        try:
            r = session.post(LOGIN_URL, headers=login_headers, json=login_payload, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Login request failed: {e}")

        # Expect successful login (200) for seeded valid credentials
        if r.status_code != 200:
            # If it's a known 422 invalid-credentials response, surface meaningful assertion
            try:
                body = r.json()
            except Exception:
                body = r.text
            raise AssertionError(f"Expected 200 on login for {email}, got {r.status_code}: {body}")

        try:
            body = r.json()
        except ValueError:
            raise AssertionError("Login response is not valid JSON")

        assert "data" in body and isinstance(body["data"], dict), "Login response missing 'data' object"
        assert body["data"].get("email") == email, "Logged in user email does not match"

        logged_in = True

        # 3) Access admin users directory - should be forbidden (403) for this role
        try:
            r = session.get(ADMIN_USERS_URL, headers={"Accept": "application/json"}, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Request to admin users endpoint failed: {e}")

        assert r.status_code == 403, f"Expected 403 FORBIDDEN from {ADMIN_USERS_URL}, got {r.status_code}"

        try:
            body = r.json()
        except ValueError:
            raise AssertionError("Admin users response is not valid JSON")

        error = body.get("error")
        assert isinstance(error, dict), f"Expected 'error' object in 403 response, got: {body}"
        assert error.get("code") == "FORBIDDEN", f"Expected error.code 'FORBIDDEN', got: {error.get('code')}"
        assert error.get("message") == "Você não tem permissão para esta ação.", f"Unexpected error.message: {error.get('message')}"

        print("TC008 passed: user without users.read permission received 403 with correct error body.")

    finally:
        # Attempt to logout to clean up session if logged in
        if logged_in:
            try:
                # Refresh CSRF token (safe to call)
                try:
                    session.get(CSRF_URL, timeout=TIMEOUT)
                except requests.RequestException:
                    pass
                xsrf_cookie = session.cookies.get("XSRF-TOKEN")
                if xsrf_cookie:
                    xsrf_token = urllib.parse.unquote(xsrf_cookie)
                    logout_headers = {
                        "X-XSRF-TOKEN": xsrf_token,
                        "Origin": "http://localhost:8080",
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    }
                else:
                    logout_headers = {"Accept": "application/json"}

                try:
                    session.post(LOGOUT_URL, headers=logout_headers, timeout=TIMEOUT)
                except requests.RequestException:
                    pass
            finally:
                session.close()

if __name__ == "__main__":
    try:
        test_admin_users_endpoint_should_return_403_without_permission()
    except AssertionError as e:
        print("TEST FAILED:", e)
        sys.exit(1)
    except Exception as e:
        print("UNEXPECTED ERROR:", e)
        sys.exit(2)
    else:
        sys.exit(0)