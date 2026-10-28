import requests

def test_get_api_health():
    session = requests.Session()
    base_url = "http://localhost:8080"
    url = f"{base_url}/api/health"
    headers = {
        "Accept": "application/json"
    }
    try:
        resp = session.get(url, headers=headers, timeout=60)
    except requests.RequestException as e:
        raise AssertionError(f"HTTP request to {url} failed: {e}")

    assert resp.status_code == 200, f"Expected HTTP 200, got {resp.status_code}. Body: {resp.text}"

    try:
        data = resp.json()
    except ValueError:
        raise AssertionError(f"Response is not valid JSON. Body: {resp.text}")

    assert isinstance(data, dict), f"Expected JSON object, got {type(data)}: {data}"

    # The health response must contain exactly 'status' and 'release'
    expected_keys = {"status", "release"}
    actual_keys = set(data.keys())
    assert actual_keys == expected_keys, f"Unexpected keys in response. Expected {expected_keys}, got {actual_keys}. Body: {data}"

    assert data.get("status") == "ok", f"Expected status 'ok', got: {data.get('status')}"
    release = data.get("release")
    assert isinstance(release, str) and release.strip() != "", f"Expected non-empty release id string, got: {release}"

    print("TC001 passed: GET /api/health returned 200 with status 'ok' and a non-empty release id.")

if __name__ == "__main__":
    test_get_api_health()