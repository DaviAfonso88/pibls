import requests
import sys

def test_tc008_get_api_auth_me_returns_401_without_authenticated_session():
    base_url = "http://localhost:8080"
    session = requests.Session()
    headers = {
        "Accept": "application/json",
        "Origin": "http://localhost:8080",
        "Referer": "http://localhost:8080/"
    }
    url = f"{base_url}/api/auth/me"
    try:
        try:
            resp = session.get(url, headers=headers, timeout=60)
        except requests.RequestException as e:
            raise AssertionError(f"HTTP request to {url} failed: {e}")

        # Expect HTTP 401 for unauthenticated access
        assert resp.status_code == 401, (
            f"Expected status code 401 for unauthenticated request, got {resp.status_code}. "
            f"Response body: {resp.text}"
        )

        # If JSON, ensure it contains an error-like structure
        content_type = resp.headers.get("Content-Type", "")
        if "application/json" in content_type:
            try:
                body = resp.json()
            except ValueError:
                raise AssertionError("Response Content-Type is application/json but body is not valid JSON")

            if isinstance(body, dict):
                if not any(k in body for k in ("message", "error", "errors")):
                    raise AssertionError(
                        "JSON response for unauthenticated did not contain expected keys like "
                        "'message', 'error' or 'errors'. Actual JSON: " + repr(body)
                    )
        # If not JSON, that's acceptable as long as 401 is returned
    finally:
        session.close()

    print("TC008 passed: GET /api/auth/me without an authenticated session returned 401 as expected")

if __name__ == "__main__":
    try:
        test_tc008_get_api_auth_me_returns_401_without_authenticated_session()
    except AssertionError as e:
        print("TC008 failed:", e)
        sys.exit(1)
    except Exception as e:
        print("TC008 unexpected error:", e)
        sys.exit(2)
    sys.exit(0)