import requests
import sys

BASE_URL = "http://localhost:8080"
TIMEOUT = 30

def test_get_public_ministries_filtered_success():
    url = f"{BASE_URL}/api/public/ministries"
    params = {
        "category": "MINISTERIO",
        "neighborhood": "Centro"
    }
    headers = {
        "Accept": "application/json"
    }

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"HTTP request to {url} failed: {e}")

    # Expect 200 for a valid filter
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}, body: {resp.text}"

    # Content-Type should be JSON
    ct = resp.headers.get("Content-Type", "")
    assert "application/json" in ct, f"Expected 'application/json' in Content-Type, got: {ct}"

    try:
        body = resp.json()
    except ValueError as e:
        raise AssertionError(f"Response is not valid JSON: {e}; body: {resp.text}")

    assert isinstance(body, dict), f"Response JSON root should be an object, got {type(body)}"
    assert "data" in body, f"Response JSON must contain 'data' key. Body: {body}"
    data = body["data"]
    assert isinstance(data, list), f"'data' must be a list, got {type(data)}"

    expected_keys = {"id","category","name","description","leaders_text","schedule_text","neighborhood","contact_phone"}
    forbidden_keys = {"private_address","contact_email"}

    # Verify each item has exactly the expected keys and does not expose private fields,
    # and matches the provided filters.
    for idx, item in enumerate(data):
        assert isinstance(item, dict), f"Each item in data must be an object/dict. Item index {idx} is {type(item)}"
        item_keys = set(item.keys())

        # No private fields present
        for fk in forbidden_keys:
            assert fk not in item_keys, f"Forbidden key '{fk}' found in item index {idx}: {item}"

        # Exact keys match
        assert item_keys == expected_keys, f"Item index {idx} keys mismatch. Expected {expected_keys}, got {item_keys}. Item: {item}"

        # Filter matching
        # category must match requested category
        assert item.get("category") == params["category"], f"Item index {idx} category does not match filter. Expected '{params['category']}', got '{item.get('category')}'. Item: {item}"
        # neighborhood must match requested neighborhood
        assert item.get("neighborhood") == params["neighborhood"], f"Item index {idx} neighborhood does not match filter. Expected '{params['neighborhood']}', got '{item.get('neighborhood')}'. Item: {item}"

    print("test_get_public_ministries_filtered_success: PASSED")

if __name__ == "__main__":
    try:
        test_get_public_ministries_filtered_success()
    except AssertionError as e:
        print(f"test_get_public_ministries_filtered_success: FAILED - {e}")
        sys.exit(1)
    except Exception as e:
        print(f"test_get_public_ministries_filtered_success: ERROR - {e}")
        sys.exit(2)
    sys.exit(0)