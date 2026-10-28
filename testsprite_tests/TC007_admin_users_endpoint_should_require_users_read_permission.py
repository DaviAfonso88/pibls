import requests
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
LOGIN_URL = f"{BASE_API}/auth/login"
ADMIN_USERS_URL = f"{BASE_API}/admin/users"
LOGOUT_URL = f"{BASE_API}/auth/logout"
TIMEOUT = 30.0

ADMIN_EMAIL = "admin@pibls.test"
ADMIN_PASSWORD = "Ts-v19iCHBnY5NYweUT"

def test_admin_users_endpoint_should_require_users_read_permission():
    session = requests.Session()
    xsrf_token_value = None

    try:
        # 1) Obtain CSRF cookie required for POST /auth/login
        r = session.get(CSRF_URL, timeout=TIMEOUT)
        assert r.status_code == 204, f"Expected 204 from CSRF endpoint, got {r.status_code}: {r.text}"
        # XSRF-TOKEN may be in session.cookies or response.cookies
        raw_xsrf = session.cookies.get("XSRF-TOKEN") or r.cookies.get("XSRF-TOKEN")
        assert raw_xsrf, "XSRF-TOKEN cookie not set by CSRF endpoint"
        xsrf_token_value = urllib.parse.unquote(raw_xsrf)

        # 2) Login as admin (has users.read)
        headers = {
            "X-XSRF-TOKEN": xsrf_token_value,
            "Origin": "http://localhost:8080",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        r = session.post(LOGIN_URL, json=payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Login failed, expected 200, got {r.status_code}: {r.text}"
        j = r.json()
        assert isinstance(j, dict) and "data" in j, f"Login response missing data: {j}"
        user = j["data"]
        # Basic checks on returned user
        for field in ("id", "name", "email", "roles", "permissions"):
            assert field in user, f"Expected '{field}' in authenticated user data"
        assert user.get("email") == ADMIN_EMAIL, f"Authenticated user email mismatch: {user.get('email')} != {ADMIN_EMAIL}"

        # 3) Access admin users directory
        r = session.get(ADMIN_USERS_URL, timeout=TIMEOUT)
        assert r.status_code == 200, f"GET {ADMIN_USERS_URL} expected 200 for user with users.read, got {r.status_code}: {r.text}"
        j = r.json()
        assert isinstance(j, dict), f"Expected JSON object from {ADMIN_USERS_URL}, got: {j}"
        assert "data" in j and isinstance(j["data"], list), f"Expected 'data' list in response: {j}"
        assert "meta" in j and isinstance(j["meta"], dict), f"Expected 'meta' in response: {j}"

        # 4) Validate each user entry and ensure no password fields are present
        required_user_fields = {"id", "name", "email", "is_active", "ministry", "roles", "permissions", "last_login_at"}
        for idx, u in enumerate(j["data"]):
            assert isinstance(u, dict), f"User at index {idx} is not an object: {u}"
            # Must not contain password
            assert "password" not in u, f"User object must not contain 'password' field: {u}"
            missing = required_user_fields - set(u.keys())
            assert not missing, f"User object missing fields {missing}: {u}"

        print("TC007 passed: admin user can access /api/admin/users and response contains expected fields without passwords.")

    except AssertionError:
        raise
    except Exception as e:
        raise RuntimeError(f"Unexpected error during test: {e}") from e
    finally:
        # Attempt logout to clean session; best-effort
        try:
            if not xsrf_token_value:
                # If token lost, try to obtain it again (safe)
                r = session.get(CSRF_URL, timeout=TIMEOUT)
                raw_xsrf = session.cookies.get("XSRF-TOKEN") or r.cookies.get("XSRF-TOKEN")
                if raw_xsrf:
                    xsrf_token_value = urllib.parse.unquote(raw_xsrf)
            if xsrf_token_value:
                headers = {
                    "X-XSRF-TOKEN": xsrf_token_value,
                    "Origin": "http://localhost:8080",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                }
                # Logout may return 204 or 401 if session already invalid; ignore non-204 as we are cleaning up
                try:
                    session.post(LOGOUT_URL, headers=headers, timeout=TIMEOUT)
                except Exception:
                    pass
        except Exception:
            pass

if __name__ == "__main__":
    try:
        test_admin_users_endpoint_should_require_users_read_permission()
    except AssertionError as ae:
        print("Assertion failed:", ae, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print("Error running test:", e, file=sys.stderr)
        sys.exit(2)
    else:
        sys.exit(0)