import requests

def test_get_sanctum_csrf_cookie_sets_xsrf_token():
    base_url = "http://localhost:8080"
    path = "/sanctum/csrf-cookie"
    url = base_url.rstrip("/") + path

    session = requests.Session()
    try:
        try:
            resp = session.get(url, timeout=30)
        except requests.RequestException as e:
            assert False, f"HTTP request to {url} failed: {e}"

        # Validate status code
        assert resp.status_code == 204, f"Expected status 204 No Content, got {resp.status_code}. Response body: {resp.text!r}"

        # 204 must have no content
        assert len(resp.content) == 0, f"Expected empty response body for 204, got {len(resp.content)} bytes."

        # Check Set-Cookie header contains XSRF-TOKEN
        set_cookie_header = resp.headers.get("Set-Cookie")
        assert set_cookie_header is not None, f"Expected 'Set-Cookie' header to be present. Headers: {dict(resp.headers)}"
        assert "XSRF-TOKEN=" in set_cookie_header, f"'Set-Cookie' header does not include XSRF-TOKEN. Header: {set_cookie_header}"

        # Also ensure the session stored the cookie
        xsrf_value = session.cookies.get("XSRF-TOKEN")
        assert xsrf_value is not None, "Session cookies do not include 'XSRF-TOKEN' after request."

        print("TC004 passed: GET /sanctum/csrf-cookie returned 204 and set XSRF-TOKEN cookie.")
    finally:
        session.close()

if __name__ == "__main__":
    test_get_sanctum_csrf_cookie_sets_xsrf_token()