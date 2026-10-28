import requests
import sys
from urllib.parse import unquote

BASE_URL = "http://localhost:8080"
TIMEOUT = 60  # per instructions, slow API use at least 60s


def test_tc003_csrf_cookie_sets_xsrf_and_session():
    sess = requests.Session()
    try:
        url = f"{BASE_URL}/sanctum/csrf-cookie"
        resp = sess.get(url, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    # Expect 204 No Content
    assert resp.status_code == 204, f"Expected 204 No Content, got {resp.status_code}, body: {resp.text!r}"

    # Cookies should be set in the session
    cookies_dict = sess.cookies.get_dict()
    # XSRF-TOKEN must be present and non-empty
    xsrf_raw = cookies_dict.get("XSRF-TOKEN")
    assert xsrf_raw is not None and xsrf_raw != "", "XSRF-TOKEN cookie is missing or empty"

    # URL-decoded value (sanity check)
    xsrf_value = unquote(xsrf_raw)
    assert xsrf_value != "", "Decoded XSRF-TOKEN is empty"

    # There must be a session cookie (Laravel typically uses laravel_session or cookie name containing 'session')
    session_cookie = None
    for c in sess.cookies:
        name = c.name.lower()
        if "session" in name or name.startswith("laravel"):
            session_cookie = c
            break

    assert session_cookie is not None, f"No session cookie found. Cookies present: {cookies_dict}"

    # Session cookie should have a non-empty value
    assert session_cookie.value != "", f"Session cookie '{session_cookie.name}' is empty"

    # Extra sanity: response should not contain JSON body
    # Some servers may include empty body; ensure content length is zero or whitespace
    body = resp.text or ""
    assert body.strip() == "", f"Expected empty body for 204 response, got: {body!r}"


if __name__ == "__main__":
    try:
        test_tc003_csrf_cookie_sets_xsrf_and_session()
    except AssertionError as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        sys.exit(2)
    else:
        print("TEST PASSED")