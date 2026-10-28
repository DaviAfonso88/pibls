import requests
import urllib.parse
import sys

BASE_URL = "http://localhost:8080"
CSRF_PATH = "/sanctum/csrf-cookie"
LOGIN_PATH = "/api/auth/login"
TIMEOUT = 60  # seconds (server is slow per instructions)

def test_post_api_auth_login_succeeds_with_valid_credentials_and_xsrf_token():
    session = requests.Session()
    try:
        # Step 1: Obtain CSRF cookie
        csrf_url = BASE_URL + CSRF_PATH
        resp = session.get(csrf_url, timeout=TIMEOUT)
        assert resp.status_code == 204, f"Expected 204 from {CSRF_PATH}, got {resp.status_code}, body: {resp.text}"

        # Extract XSRF-TOKEN cookie and URL-decode it
        raw_xsrf = session.cookies.get("XSRF-TOKEN")
        assert raw_xsrf is not None, f"XSRF-TOKEN cookie not set after GET {CSRF_PATH}. Cookies: {session.cookies.items()}"
        xsrf_token = urllib.parse.unquote(raw_xsrf)

        # Prepare headers required by the API for POST
        headers = {
            "X-XSRF-TOKEN": xsrf_token,
            "Accept": "application/json",
            "Origin": "http://localhost:8080",
            "Referer": "http://localhost:8080/",
        }

        # Step 2: Perform login with valid credentials
        login_url = BASE_URL + LOGIN_PATH
        payload = {
            "email": "secretaria@pibls.test",
            "password": "senha-local-123"
        }
        resp = session.post(login_url, json=payload, headers=headers, timeout=TIMEOUT)
        # Validate success response
        assert resp.status_code == 200, f"Expected 200 from {LOGIN_PATH} with valid credentials, got {resp.status_code}. Body: {resp.text}"

        try:
            data = resp.json()
        except ValueError:
            raise AssertionError(f"Response from {LOGIN_PATH} is not valid JSON. Body: {resp.text}")

        assert isinstance(data, dict), f"Expected JSON object in response, got: {type(data)}"

        # The PRD states the 200 response contains user roles and permissions.
        # Accept either top-level 'roles'/'permissions' or nested under 'user' or 'data'
        roles_present = False
        permissions_present = False

        if "roles" in data and isinstance(data["roles"], list):
            roles_present = True
        if "permissions" in data and isinstance(data["permissions"], list):
            permissions_present = True

        if "user" in data and isinstance(data["user"], dict):
            user = data["user"]
            if "roles" in user and isinstance(user["roles"], list):
                roles_present = True
            if "permissions" in user and isinstance(user["permissions"], list):
                permissions_present = True

        # Accept also when the payload nests the user under 'data'
        if "data" in data and isinstance(data["data"], dict):
            user = data["data"]
            if "roles" in user and isinstance(user["roles"], list):
                roles_present = True
            if "permissions" in user and isinstance(user["permissions"], list):
                permissions_present = True

        assert roles_present, f"Response JSON does not contain 'roles' list. Response: {data}"
        # permissions may be optional depending on implementation, but the PRD expects roles and permissions.
        assert permissions_present, f"Response JSON does not contain 'permissions' list. Response: {data}"

        # Optionally verify a session cookie is present after successful login (typical Laravel session)
        session_cookie = None
        for name, _ in session.cookies.items():
            if name.lower().startswith("laravel") or name.lower().endswith("session"):
                session_cookie = name
                break
        assert session_cookie is not None, f"No session cookie found after login. Cookies: {session.cookies.items()}"

        print("TEST PASSED: Login succeeded, roles and permissions present, session cookie set.")

    except AssertionError:
        raise
    except requests.RequestException as e:
        raise AssertionError(f"HTTP request failed: {e}") from e
    finally:
        # Attempt to clean up by calling a logout endpoint if it exists (best-effort)
        try:
            logout_url = BASE_URL + "/api/auth/logout"
            # Use same headers including CSRF token; ignore errors from logout
            session.post(logout_url, headers={
                "X-XSRF-TOKEN": urllib.parse.unquote(session.cookies.get("XSRF-TOKEN") or "")
            }, timeout=10)
        except Exception:
            pass


if __name__ == "__main__":
    try:
        test_post_api_auth_login_succeeds_with_valid_credentials_and_xsrf_token()
    except AssertionError as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        sys.exit(2)
    else:
        sys.exit(0)