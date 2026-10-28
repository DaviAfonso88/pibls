import requests
import sys

BASE_URL = "http://localhost:8080"
TIMEOUT = 30  # seconds

def test_get_api_health_returns_status_ok_and_release_id():
    url = f"{BASE_URL}/api/health"
    headers = {
        "Accept": "application/json"
    }

    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        # Network or connection error - fail the test
        raise AssertionError(f"Request to {url} failed: {e}")

    # Expect HTTP 200 when the database is reachable
    assert resp.status_code == 200, f"Expected status code 200, got {resp.status_code}. Response body: {resp.text}"

    # Content-Type should be JSON (allow charset)
    content_type = resp.headers.get("Content-Type", "")
    assert "application/json" in content_type.lower(), f"Expected 'application/json' in Content-Type header, got: {content_type}"

    # Parse JSON body
    try:
        body = resp.json()
    except ValueError as e:
        raise AssertionError(f"Response did not contain valid JSON: {e}. Raw response: {resp.text}")

    # Validate expected shape and values
    assert isinstance(body, dict), f"Expected JSON object, got: {type(body)}"
    assert "status" in body, f"Missing 'status' key in response JSON: {body}"
    assert body["status"] == "ok", f"Expected status 'ok', got: {body.get('status')}"
    assert "release" in body, f"Missing 'release' key in response JSON: {body}"
    release = body["release"]
    assert isinstance(release, str) and release.strip() != "", f"'release' must be a non-empty string, got: {release}"

    # Ensure error envelope is not present
    assert "error" not in body, f"Unexpected 'error' envelope in successful health response: {body}"

    print("TC001 passed: /api/health returned 200 with status 'ok' and a non-empty release id.")

if __name__ == "__main__":
    try:
        test_get_api_health_returns_status_ok_and_release_id()
    except AssertionError as e:
        print(f"TC001 failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC001 encountered an unexpected exception: {e}")
        sys.exit(2)
    sys.exit(0)