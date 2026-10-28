import requests
import sys

BASE_URL = "http://localhost:8080"
TIMEOUT = 30
ULID = "01ARYZ6S41TSV4RRFFQ69G5FAV"

def test_tc006_get_unknown_api_route_returns_404():
    url = f"{BASE_URL}/api/this-route-does-not-exist-xyz"
    headers = {
        "Accept": "application/json",
        "X-Request-Id": ULID
    }

    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        raise AssertionError(f"HTTP request failed: {e}")

    # Status code
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}. Response text: {resp.text[:500]}"

    # Response must not be HTML
    content_type = resp.headers.get("Content-Type", "")
    body_text_lower = (resp.text or "").lower()
    assert "application/json" in content_type.lower() or "application/json" in body_text_lower, (
        f"Response does not appear to be JSON. Content-Type: {content_type}. Response start: {resp.text[:200]}"
    )
    assert "<html" not in body_text_lower, "Response contains HTML; expected JSON error envelope."

    # X-Request-Id header must match the sent ULID
    resp_req_id = resp.headers.get("X-Request-Id")
    assert resp_req_id == ULID, f"Expected response X-Request-Id header to be '{ULID}', got '{resp_req_id}'"

    # Parse JSON body
    try:
        payload = resp.json()
    except ValueError as e:
        raise AssertionError(f"Response body is not valid JSON: {e}. Body: {resp.text[:500]}")

    assert isinstance(payload, dict), f"Expected JSON object at top level, got {type(payload)}"

    # Validate error envelope structure
    assert "error" in payload and isinstance(payload["error"], dict), "Missing 'error' object in response JSON."
    error = payload["error"]

    # Validate fields
    expected_message = "Não encontramos o que você procurou."
    assert error.get("code") == "NOT_FOUND", f"Expected error.code 'NOT_FOUND', got '{error.get('code')}'"
    assert error.get("message") == expected_message, f"Expected error.message '{expected_message}', got '{error.get('message')}'"

    details = error.get("details")
    assert isinstance(details, list), f"Expected error.details to be a list, got {type(details)}"
    assert len(details) == 0, f"Expected error.details to be empty list, got {details}"

    trace_id = error.get("traceId")
    assert trace_id == ULID, f"Expected error.traceId to equal '{ULID}', got '{trace_id}'"
    # Double-check traceId matches header
    assert trace_id == resp_req_id, f"traceId '{trace_id}' does not match response header X-Request-Id '{resp_req_id}'"

    print("TC006 passed: unknown API route returns 404 with correct JSON error envelope and matching X-Request-Id.")

if __name__ == "__main__":
    try:
        test_tc006_get_unknown_api_route_returns_404()
    except AssertionError as e:
        print(f"TC006 failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC006 encountered an unexpected error: {e}")
        sys.exit(2)
    sys.exit(0)