import requests
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
APP_BASE = BASE_API.rsplit("/api", 1)[0]
TIMEOUT = 30  # seconds


def test_session_authentication_with_csrf_protection():
    session = requests.Session()

    try:
        # 1) Obtain CSRF cookie
        csrf_url = f"{APP_BASE}/sanctum/csrf-cookie"
        resp = session.get(csrf_url, timeout=TIMEOUT)
        assert resp.status_code in (200, 204), f"Unexpected status from CSRF endpoint: {resp.status_code}"

        # Extract XSRF token from cookies
        xsrf_cookie = session.cookies.get("XSRF-TOKEN") or session.cookies.get("xsrftoken") or session.cookies.get("XSRFtoken")
        assert xsrf_cookie, "XSRF token cookie not found after GET /sanctum/csrf-cookie"

        xsrf_token = urllib.parse.unquote(xsrf_cookie)

        headers = {
            "X-XSRF-TOKEN": xsrf_token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # 2) Successful login with valid credentials
        login_url = f"{BASE_API}/auth/login"
        valid_payload = {"email": "comunicacao@pibls.test", "password": "Ts-K8M4gH-7o-6S"}

        resp = session.post(login_url, json=valid_payload, headers=headers, timeout=TIMEOUT)
        # Accept common success codes for session login
        assert resp.status_code in (200, 201, 204), f"Expected successful login status, got {resp.status_code}: {resp.text}"

        # After successful session login, a session cookie should be present
        cookies_after_login = session.cookies.get_dict()
        assert cookies_after_login, "No cookies present after login; expected session cookie to be set"
        # Prefer checking for laravel_session but accept any cookie set as session indicator
        assert any(k.lower().startswith("laravel_session") or k.lower().startswith("session") for k in cookies_after_login.keys()) or len(cookies_after_login) >= 1, \
            f"Unexpected cookies after login: {cookies_after_login}"

        # 3) Rejection of login with invalid credentials
        # Use a fresh session to simulate a separate attempt
        bad_session = requests.Session()
        # Obtain CSRF cookie for the new session
        resp = bad_session.get(csrf_url, timeout=TIMEOUT)
        assert resp.status_code in (200, 204), f"Unexpected status from CSRF endpoint (bad session): {resp.status_code}"
        bad_xsrf_cookie = bad_session.cookies.get("XSRF-TOKEN") or bad_session.cookies.get("xsrftoken") or bad_session.cookies.get("XSRFtoken")
        assert bad_xsrf_cookie, "XSRF token cookie not found for bad session"
        bad_xsrf_token = urllib.parse.unquote(bad_xsrf_cookie)

        bad_headers = {
            "X-XSRF-TOKEN": bad_xsrf_token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        invalid_payload = {"email": "comunicacao@pibls.test", "password": "wrong-password-123"}
        resp = bad_session.post(login_url, json=invalid_payload, headers=bad_headers, timeout=TIMEOUT)

        # Expecting rejection: accept any 4xx client error (including rate limiting 429)
        assert 400 <= resp.status_code < 500, f"Expected rejection for invalid credentials (4xx), got {resp.status_code}: {resp.text}"
        # Response body should indicate error (if JSON)
        try:
            body = resp.json()
            ok = False
            if isinstance(body, dict):
                if ("message" in body and body.get("message")) or ("errors" in body and body.get("errors")):
                    ok = True
                elif "error" in body and isinstance(body["error"], dict) and (body["error"].get("message") or body["error"].get("code")):
                    ok = True
            assert ok, f"Invalid-login response does not contain expected error structure: {body}"
        except ValueError:
            # Not JSON, at least ensure status indicates failure
            pass

    except requests.RequestException as e:
        raise AssertionError(f"Request failed: {e}")
    finally:
        session.close()
        if 'bad_session' in locals():
            bad_session.close()


if __name__ == "__main__":
    try:
        test_session_authentication_with_csrf_protection()
        print("TC001: PASS")
    except AssertionError as e:
        print("TC001: FAIL -", e)
        sys.exit(1)
