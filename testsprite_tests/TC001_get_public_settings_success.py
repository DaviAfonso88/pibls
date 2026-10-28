import requests
import sys

BASE_URL = "http://localhost:8080"
TIMEOUT = 30


def test_get_public_settings_success():
    url = f"{BASE_URL}/api/public/settings"
    try:
        resp = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"HTTP request to {url} failed: {e}")

    # Basic HTTP checks
    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}. Body: {resp.text}"
    content_type = resp.headers.get("Content-Type", "")
    assert "application/json" in content_type.lower(), f"Expected JSON response, got Content-Type: {content_type}"

    # Cache-Control expectation from PRD (must be present and include public, max-age=60)
    cache_control = resp.headers.get("Cache-Control", "")
    assert "public" in cache_control and "max-age=60" in cache_control, f"Expected 'Cache-Control' to include 'public' and 'max-age=60', got: '{cache_control}'"

    body_text = resp.text
    # Ensure private recipients are not exposed in the response body
    assert "notification_recipients" not in body_text, "Response body must not contain 'notification_recipients'"

    # Parse JSON
    try:
        payload = resp.json()
    except ValueError as e:
        raise AssertionError(f"Response is not valid JSON: {e}. Body: {resp.text}")

    # Top-level data key
    assert isinstance(payload, dict), f"Top-level response must be an object, got {type(payload)}"
    assert "data" in payload, f"Response JSON must contain 'data' key. Full payload: {payload}"
    data = payload["data"]
    assert isinstance(data, dict), "'data' must be an object"

    # Required public settings keys
    expected_keys = {
        "schedule",
        "campaign_notice",
        "lords_supper_notice",
        "address",
        "map_links",
        "whatsapp",
        "youtube_links",
        "social_links",
        "pix",
        "features",
    }
    missing = expected_keys - set(data.keys())
    assert not missing, f"Missing expected keys in data: {missing}. Present keys: {list(data.keys())}"

    # Type checks for several fields
    assert isinstance(data["schedule"], list), "'schedule' must be an array"
    assert isinstance(data["campaign_notice"], dict), "'campaign_notice' must be an object"
    assert isinstance(data["lords_supper_notice"], dict), "'lords_supper_notice' must be an object"
    assert isinstance(data["map_links"], dict), "'map_links' must be an object"
    assert isinstance(data["whatsapp"], dict), "'whatsapp' must be an object"
    assert isinstance(data["youtube_links"], dict) or isinstance(data["youtube_links"], list), "'youtube_links' must be an object or array"
    assert isinstance(data["social_links"], list), "'social_links' must be an array"
    assert isinstance(data["pix"], dict), "'pix' must be an object"
    assert isinstance(data["features"], dict), "'features' must be an object"

    # Whatsapp expected fields
    whatsapp = data["whatsapp"]
    for k in ("phone", "default_text"):
        assert k in whatsapp, f"Missing whatsapp.{k}"

    # PIX expected fields
    pix = data["pix"]
    for k in ("pix_key", "beneficiary_name", "qr_image_url", "copy_paste_code"):
        assert k in pix, f"Missing pix.{k}"

    # If schedule items exist, verify expected keys on the first item
    if data["schedule"]:
        first_schedule = data["schedule"][0]
        assert isinstance(first_schedule, dict), "Each schedule item must be an object"
        for k in ("day", "recurrence", "activity", "time", "mode"):
            assert k in first_schedule, f"Missing schedule item key: {k}"

    # Features should include at least one known flag (per PRD 'events' exists)
    assert "events" in data["features"], "Expected 'events' key in features"

    # Additionally ensure the parsed JSON does not include the forbidden key anywhere
    def traverse_and_assert_no_key(obj, forbidden_key="notification_recipients"):
        if isinstance(obj, dict):
            for key, val in obj.items():
                assert key != forbidden_key, f"Found forbidden key '{forbidden_key}' in response JSON"
                traverse_and_assert_no_key(val, forbidden_key)
        elif isinstance(obj, list):
            for item in obj:
                traverse_and_assert_no_key(item, forbidden_key)

    traverse_and_assert_no_key(payload, "notification_recipients")

    print("test_get_public_settings_success: PASS")


if __name__ == "__main__":
    try:
        test_get_public_settings_success()
    except AssertionError as e:
        print(f"test_get_public_settings_success: FAIL - {e}")
        sys.exit(1)
    except Exception as e:
        print(f"test_get_public_settings_success: ERROR - Unexpected exception: {e}")
        sys.exit(2)
    sys.exit(0)