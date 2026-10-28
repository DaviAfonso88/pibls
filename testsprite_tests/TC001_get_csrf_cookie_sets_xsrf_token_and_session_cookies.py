import requests
import urllib.parse
import sys
from requests.exceptions import RequestException

def test_get_csrf_cookie_sets_xsrf_and_session_cookies():
    """
    TC001: Verify that a GET request to /sanctum/csrf-cookie returns 204
    and sets the XSRF-TOKEN and pibls-session cookies correctly.
    """
    csrf_url = "http://localhost:8080/sanctum/csrf-cookie"
    session = requests.Session()
    try:
        resp = session.get(csrf_url, timeout=30, headers={"Accept": "application/json"})
    except RequestException as e:
        raise AssertionError(f"Request to {csrf_url} failed: {e}")

    # Validate status code
    assert resp.status_code == 204, f"Expected status 204 from {csrf_url}, got {resp.status_code}. Response body: {resp.text}"

    # Try to obtain cookies from the session first, fallback to response.cookies
    xsrf_cookie = session.cookies.get("XSRF-TOKEN") or resp.cookies.get("XSRF-TOKEN")
    session_cookie = session.cookies.get("pibls-session") or resp.cookies.get("pibls-session")

    assert xsrf_cookie is not None and xsrf_cookie != "", "XSRF-TOKEN cookie was not set or is empty"
    assert session_cookie is not None and session_cookie != "", "pibls-session cookie was not set or is empty"

    # URL-decode the XSRF token
    decoded_xsrf = urllib.parse.unquote(xsrf_cookie)
    assert decoded_xsrf != "", "Decoded XSRF-TOKEN is empty"

    # Prepare headers that would be used for subsequent writes to ensure token usable
    headers = {
        "X-XSRF-TOKEN": decoded_xsrf,
        "Origin": "http://localhost:8080",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    assert headers["X-XSRF-TOKEN"], "Prepared X-XSRF-TOKEN header is empty"

    print("TC001 passed: /sanctum/csrf-cookie returned 204 and set XSRF-TOKEN and pibls-session cookies correctly.")

if __name__ == "__main__":
    try:
        test_get_csrf_cookie_sets_xsrf_and_session_cookies()
    except AssertionError as e:
        print("Test failed:", e)
        sys.exit(1)
    except Exception as e:
        print("Unexpected error during test:", e)
        sys.exit(2)
    sys.exit(0)