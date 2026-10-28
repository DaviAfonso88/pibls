import requests
import sys

BASE_URL = "http://localhost:8080"
TIMEOUT = 30
HEADERS = {"Accept": "application/json"}


def get_public_ministries_list_success():
    url = f"{BASE_URL}/api/public/ministries"
    expected_keys = {
        "id",
        "category",
        "name",
        "description",
        "leaders_text",
        "schedule_text",
        "neighborhood",
        "contact_phone",
    }
    forbidden_keys = {"private_address", "contact_email"}

    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    # Verify status code
    if resp.status_code != 200:
        # try to include error envelope for debugging
        try:
            err = resp.json()
        except Exception:
            err = resp.text
        raise AssertionError(f"Expected 200 OK from {url}, got {resp.status_code}. Response: {err}")

    # Parse JSON
    try:
        body = resp.json()
    except ValueError as e:
        raise AssertionError(f"Response from {url} is not valid JSON: {e}")

    # Validate top-level structure
    assert "data" in body, f"'data' key missing in response from {url}"
    data = body["data"]
    assert isinstance(data, list), f"'data' must be a list, got {type(data)}"

    # Must contain at least one ministry (catalog is seeded)
    assert len(data) > 0, "Expected at least one ministry in the public ministries list"

    # Validate each item contains exactly the expected public keys and does not contain private keys
    for idx, item in enumerate(data):
        assert isinstance(item, dict), f"Item at index {idx} is not an object/dict"
        item_keys = set(item.keys())

        # No private keys present
        intersection = item_keys & forbidden_keys
        assert not intersection, f"Item at index {idx} contains forbidden private keys: {intersection}"

        # Exactly the expected public keys
        assert item_keys == expected_keys, (
            f"Item at index {idx} keys mismatch. Expected exactly: {expected_keys}. Got: {item_keys}"
        )

    # Ensure the returned array is deterministic / ordered: second identical call must return the same sequence
    try:
        resp2 = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        raise AssertionError(f"Second request to {url} failed: {e}")

    if resp2.status_code != 200:
        try:
            err2 = resp2.json()
        except Exception:
            err2 = resp2.text
        raise AssertionError(f"Expected 200 OK on second request to {url}, got {resp2.status_code}. Response: {err2}")

    try:
        body2 = resp2.json()
    except ValueError as e:
        raise AssertionError(f"Second response from {url} is not valid JSON: {e}")

    assert "data" in body2, "Second response missing 'data' key"
    data2 = body2["data"]
    assert isinstance(data2, list), "Second response 'data' is not a list"

    # Compare the two lists for equality to ensure ordering is stable/deterministic
    assert data == data2, "Ministries list order/content differs between identical requests; expected deterministic ordering"

    print("get_public_ministries_list_success: PASSED")


if __name__ == "__main__":
    try:
        get_public_ministries_list_success()
    except AssertionError as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        sys.exit(2)
    sys.exit(0)