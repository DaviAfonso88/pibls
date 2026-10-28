import requests
import urllib.parse
import sys

BASE = "http://localhost:8080"
API_BASE = BASE + "/api"
CSRF_URL = BASE + "/sanctum/csrf-cookie"
LOGIN_URL = API_BASE + "/auth/login"
TIMEOUT = 30


def test_session_and_csrf_cookie_authentication():
    try:
        # 1) GET /sanctum/csrf-cookie returns 204 and sets cookies
        s = requests.Session()
        r = s.get(CSRF_URL, timeout=TIMEOUT)
        assert r.status_code == 204, f"Expected 204 from csrf-cookie endpoint, got {r.status_code}: {r.text}"
        xsrf_cookie = s.cookies.get("XSRF-TOKEN")
        session_cookie = s.cookies.get("pibls_session")
        assert xsrf_cookie is not None, "XSRF-TOKEN cookie not set by csrf-cookie endpoint"
        assert session_cookie is not None, "pibls_session cookie not set by csrf-cookie endpoint"

        # Prepare headers using URL-decoded XSRF-TOKEN
        xsrf_decoded = urllib.parse.unquote(xsrf_cookie)
        common_headers = {
            "X-XSRF-TOKEN": xsrf_decoded,
            "Origin": BASE,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # 2) POST /api/auth/login with valid credentials and proper X-XSRF-TOKEN -> 200 (establishes session)
        valid_payload = {"email": "secretaria@pibls.test", "password": "Ts-5alRJbooOoboi0aM"}
        r_login = s.post(LOGIN_URL, json=valid_payload, headers=common_headers, timeout=TIMEOUT)
        assert r_login.status_code == 200, f"Expected 200 on valid login, got {r_login.status_code}: {r_login.text}"
        # Session cookie should be present/updated after login
        assert s.cookies.get("pibls_session") is not None, "pibls_session cookie missing after successful login"

        # 3) POST /api/auth/login without CSRF cookie/header -> 419
        s_no_csrf = requests.Session()
        headers_no_csrf = {"Origin": BASE, "Accept": "application/json", "Content-Type": "application/json"}
        payload_invalid_user = {"email": "nonexistent@pibls.test", "password": "wrong-password"}
        r_no_csrf = s_no_csrf.post(LOGIN_URL, json=payload_invalid_user, headers=headers_no_csrf, timeout=TIMEOUT)
        assert r_no_csrf.status_code == 419, f"Expected 419 for missing CSRF token, got {r_no_csrf.status_code}: {r_no_csrf.text}"

        # 4) POST /api/auth/login with invalid CSRF token -> 419
        s_bad_csrf = requests.Session()
        r_csrf2 = s_bad_csrf.get(CSRF_URL, timeout=TIMEOUT)
        assert r_csrf2.status_code == 204, f"Expected 204 from csrf-cookie before invalid-csrf test, got {r_csrf2.status_code}"
        # Intentionally send a wrong token value
        headers_bad_csrf = {
            "X-XSRF-TOKEN": "this_is_an_invalid_token_value",
            "Origin": BASE,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        payload_for_oracao = {"email": "oracao@pibls.test", "password": "Ts-5alRJbooOoboi0aM"}
        r_bad_csrf = s_bad_csrf.post(LOGIN_URL, json=payload_for_oracao, headers=headers_bad_csrf, timeout=TIMEOUT)
        assert r_bad_csrf.status_code == 419, f"Expected 419 for invalid CSRF token, got {r_bad_csrf.status_code}: {r_bad_csrf.text}"

        # 5) POST /api/auth/login with invalid credentials but valid CSRF -> 401 or validation failure (422)
        s_invalid_cred = requests.Session()
        r_csrf3 = s_invalid_cred.get(CSRF_URL, timeout=TIMEOUT)
        assert r_csrf3.status_code == 204, f"Expected 204 from csrf-cookie before invalid-credentials test, got {r_csrf3.status_code}"
        xsrf3 = s_invalid_cred.cookies.get("XSRF-TOKEN")
        assert xsrf3 is not None, "XSRF-TOKEN missing before invalid-credentials test"
        headers_invalid_cred = {
            "X-XSRF-TOKEN": urllib.parse.unquote(xsrf3),
            "Origin": BASE,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        payload_wrong_password = {"email": "someuser@pibls.test", "password": "incorrect-password"}
        r_invalid_cred = s_invalid_cred.post(LOGIN_URL, json=payload_wrong_password, headers=headers_invalid_cred, timeout=TIMEOUT)
        assert r_invalid_cred.status_code in (401, 422), f"Expected 401 or 422 for invalid credentials, got {r_invalid_cred.status_code}: {r_invalid_cred.text}"
        if r_invalid_cred.status_code == 422:
            try:
                j = r_invalid_cred.json()
            except ValueError:
                assert False, "Expected JSON body on 422 invalid credentials"
            code = None
            if isinstance(j, dict):
                code = j.get("error", {}).get("code") if j.get("error") else j.get("code")
            assert code == "INVALID_CREDENTIALS", f"Expected error code INVALID_CREDENTIALS for 422 response, got {j}"

        print("TC001 passed: session and CSRF cookie authentication flows behave as expected.")

    except requests.exceptions.RequestException as e:
        raise SystemExit(f"HTTP request failed: {e}")


if __name__ == "__main__":
    test_session_and_csrf_cookie_authentication()