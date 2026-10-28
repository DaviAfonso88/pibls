import requests

BASE_ENDPOINT = "http://localhost:8080"


def test_get_health_check_route_returns_200_when_app_is_healthy():
    """
    TC003: Verify that GET /up returns 200 and an HTML health page when the app is healthy.
    """
    session = requests.Session()
    url = f"{BASE_ENDPOINT.rstrip('/')}/up"
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
    try:
        try:
            resp = session.get(url, headers=headers, timeout=30)
        except requests.exceptions.RequestException as e:
            raise AssertionError(f"HTTP request to {url} failed: {e}")

        # Assert status code is 200
        assert resp.status_code == 200, (
            f"Expected status code 200 but got {resp.status_code}. "
            f"Response body (truncated): {resp.text[:500]!r}"
        )

        # Check that the response is HTML
        content_type = resp.headers.get("Content-Type", "")
        body_lower = resp.text.lower() if resp.text else ""
        is_html = ("html" in content_type.lower()) or ("<html" in body_lower) or ("<!doctype" in body_lower)
        assert is_html, f"Response does not appear to be HTML. Content-Type: {content_type!r}. Body (truncated): {resp.text[:300]!r}"

    finally:
        session.close()


if __name__ == "__main__":
    try:
        test_get_health_check_route_returns_200_when_app_is_healthy()
        print("TC003 passed")
    except AssertionError as e:
        print("TC003 failed:", e)
        raise
    except Exception as e:
        print("TC003 error:", e)
        raise