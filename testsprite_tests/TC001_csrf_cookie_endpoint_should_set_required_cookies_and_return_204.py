import requests
import urllib.parse
import sys

BASE = "http://localhost:8080"
CSRF_PATH = "/sanctum/csrf-cookie"
TIMEOUT = 30

def test_csrf_cookie_endpoint_should_set_required_cookies_and_return_204():
    session = requests.Session()
    url = BASE + CSRF_PATH

    try:
        try:
            resp = session.get(url, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Request to {url} failed: {e}") from e

        # Assert status code
        assert resp is not None, "No response received"
        assert resp.status_code == 204, f"Expected HTTP 204, got {resp.status_code}, body: {resp.text}"

        # Check cookies in the session
        xsrf_cookie = session.cookies.get("XSRF-TOKEN")
        pibls_cookie = session.cookies.get("pibls_session")

        assert xsrf_cookie is not None and xsrf_cookie != "", "XSRF-TOKEN cookie not set or empty"
        assert pibls_cookie is not None and pibls_cookie != "", "pibls_session cookie not set or empty"

        # URL-decode XSRF token and ensure it's non-empty after decoding
        decoded_xsrf = urllib.parse.unquote(xsrf_cookie)
        assert decoded_xsrf != "", "Decoded XSRF-TOKEN is empty"

        # Basic sanity: decoded token should look like a token (at least some length)
        assert len(decoded_xsrf) >= 8, f"Decoded XSRF-TOKEN looks too short: '{decoded_xsrf}'"

        print("TC001 passed: CSRF endpoint returned 204 and set XSRF-TOKEN and pibls_session cookies.")

    finally:
        session.close()

if __name__ == "__main__":
    try:
        test_csrf_cookie_endpoint_should_set_required_cookies_and_return_204()
    except AssertionError as e:
        print("TC001 failed:", e)
        sys.exit(1)
    except Exception as e:
        print("TC001 encountered an unexpected error:", e)
        sys.exit(2)
    sys.exit(0)