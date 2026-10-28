import sys
import requests

BASE_URL = "http://localhost:8080"

def test_get_public_ministries_invalid_category_validation_error():
    url = f"{BASE_URL}/api/public/ministries"
    headers = {"Accept": "application/json"}
    params = {"category": "INVALID"}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"HTTP request to {url} failed: {e}")

    # Expect HTTP 422 for invalid category
    assert resp.status_code == 422, f"Expected status 422, got {resp.status_code}. Body: {resp.text}"

    # Parse JSON body
    try:
        body = resp.json()
    except ValueError:
        raise AssertionError(f"Response is not valid JSON. Status: {resp.status_code}, Body: {resp.text}")

    # Validate error envelope structure
    assert isinstance(body, dict), f"Response JSON is not an object: {body}"
    assert "error" in body and isinstance(body["error"], dict), f"Missing or invalid 'error' object in response: {body}"

    error = body["error"]
    # Validate error code
    assert error.get("code") == "VALIDATION_ERROR", f"Expected error.code 'VALIDATION_ERROR', got {error.get('code')}"
    # Validate details array and first detail's field
    assert "details" in error and isinstance(error["details"], list) and len(error["details"]) > 0, f"error.details missing or empty: {error.get('details')}"
    first_detail = error["details"][0]
    assert isinstance(first_detail, dict), f"error.details[0] is not an object: {first_detail}"
    assert first_detail.get("field") == "category", f"Expected error.details[0].field == 'category', got {first_detail.get('field')}"

    # Ensure traceId exists for correlation
    assert "traceId" in error and error["traceId"], f"Missing or empty error.traceId: {error}"

if __name__ == "__main__":
    try:
        test_get_public_ministries_invalid_category_validation_error()
        print("TC006 passed")
    except AssertionError as e:
        print("TC006 failed:", e)
        sys.exit(1)