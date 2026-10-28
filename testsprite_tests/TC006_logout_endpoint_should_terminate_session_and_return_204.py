import requests
import urllib.parse
import sys

BASE_HOST = "http://localhost:8080"
API_BASE = BASE_HOST + "/api"
CSRF_PATH = BASE_HOST + "/sanctum/csrf-cookie"
TIMEOUT = 30

def test_logout_endpoint_should_terminate_session_and_return_204():
    session = requests.Session()
    try:
        # Fetch CSRF cookie before login
        r = session.get(CSRF_PATH, timeout=TIMEOUT)
        assert r.status_code == 204, f"Expected 204 from csrf-cookie, got {r.status_code}, body={r.text}"
        xsrf_cookie = session.cookies.get("XSRF-TOKEN")
        assert xsrf_cookie, "XSRF-TOKEN cookie missing after csrf-cookie request"
        xsrf_token = urllib.parse.unquote(xsrf_cookie)

        # Login with seeded admin user (login once)
        login_headers = {
            "X-XSRF-TOKEN": xsrf_token,
            "Origin": BASE_HOST,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        login_payload = {
            "email": "admin@pibls.test",
            "password": "Ts-v19iCHBnY5NYweUT"
        }
        r = session.post(f"{API_BASE}/auth/login", json=login_payload, headers=login_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Login failed: expected 200, got {r.status_code}, body={r.text}"
        login_json = r.json()
        assert "data" in login_json and login_json["data"].get("email") == "admin@pibls.test", "Login response missing expected user data"
        assert session.cookies.get("pibls_session") is not None, "Session cookie (pibls_session) not set after login"

        # Verify authenticated GET /api/auth/me returns 200
        r = session.get(f"{API_BASE}/auth/me", headers={"Accept": "application/json"}, timeout=TIMEOUT)
        assert r.status_code == 200, f"Expected 200 from /auth/me when authenticated, got {r.status_code}, body={r.text}"

        # For POST logout, fetch CSRF cookie again as required
        r = session.get(CSRF_PATH, timeout=TIMEOUT)
        assert r.status_code == 204, f"Expected 204 from csrf-cookie before logout, got {r.status_code}, body={r.text}"
        xsrf_cookie = session.cookies.get("XSRF-TOKEN")
        assert xsrf_cookie, "XSRF-TOKEN cookie missing before logout"
        xsrf_token = urllib.parse.unquote(xsrf_cookie)

        logout_headers = {
            "X-XSRF-TOKEN": xsrf_token,
            "Origin": BASE_HOST,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        r = session.post(f"{API_BASE}/auth/logout", headers=logout_headers, timeout=TIMEOUT)
        assert r.status_code == 204, f"Expected 204 from logout, got {r.status_code}, body={r.text}"

        # After logout, GET /api/auth/me should return 401 with UNAUTHENTICATED error
        r = session.get(f"{API_BASE}/auth/me", headers={"Accept": "application/json"}, timeout=TIMEOUT)
        assert r.status_code == 401, f"Expected 401 from /auth/me after logout, got {r.status_code}, body={r.text}"
        body = r.json()
        assert "error" in body, f"Expected error object in body after logout, got {body}"
        assert body["error"].get("code") == "UNAUTHENTICATED", f"Expected error.code UNAUTHENTICATED, got {body['error'].get('code')}"
        assert "Sua sessão expirou" in body["error"].get("message", ""), f"Expected session-expired message, got {body['error'].get('message')}"
        print("TC006 passed")
    finally:
        # Best-effort cleanup: try to logout if session cookie still present (ignore errors)
        try:
            if session.cookies.get("pibls_session"):
                session.get(CSRF_PATH, timeout=TIMEOUT)
                xsrf_cookie = session.cookies.get("XSRF-TOKEN")
                if xsrf_cookie:
                    xsrf_token = urllib.parse.unquote(xsrf_cookie)
                    headers = {
                        "X-XSRF-TOKEN": xsrf_token,
                        "Origin": BASE_HOST,
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    }
                    # attempt logout; ignore result
                    session.post(f"{API_BASE}/auth/logout", headers=headers, timeout=TIMEOUT)
        except Exception:
            pass

if __name__ == "__main__":
    try:
        test_logout_endpoint_should_terminate_session_and_return_204()
    except AssertionError as e:
        print("TC006 failed:", e)
        sys.exit(1)
    except requests.RequestException as e:
        print("TC006 failed due to request error:", e)
        sys.exit(2)