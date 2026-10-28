import requests

def test_tc009_public_settings_excludes_notification_recipients():
    base_url = "http://localhost:8080"
    url = f"{base_url}/api/public/settings"
    headers = {"Accept": "application/json"}
    timeout_seconds = 60

    try:
        resp = requests.get(url, headers=headers, timeout=timeout_seconds)
    except requests.RequestException as e:
        print(f"HTTP request to {url} failed: {e}")
        raise

    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}. Body: {resp.text}"

    try:
        body = resp.json()
    except ValueError:
        raise AssertionError(f"Response is not valid JSON: {resp.text}")

    # Top-level envelope check
    assert isinstance(body, dict), "Response JSON must be an object"
    assert set(body.keys()) == {"data"}, f"Top-level JSON keys must be exactly ['data'], got {list(body.keys())}"

    data = body["data"]
    assert isinstance(data, dict), "data must be an object"

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
    assert set(data.keys()) == expected_keys, f"data keys mismatch. expected {expected_keys}, got {set(data.keys())}"

    # Type checks for important fields
    assert isinstance(data["schedule"], list), f"Expected 'schedule' to be a list, got {type(data['schedule'])}"

    # Ensure forbidden keys do not appear anywhere in the JSON text
    forbidden = ["notification_recipients", "private_address", "contact_email"]
    response_text = resp.text
    for key in forbidden:
        assert key not in response_text, f"Forbidden key '{key}' found in response text"

    print("TC009 passed: Public settings returned expected keys and excluded forbidden fields.")

if __name__ == "__main__":
    test_tc009_public_settings_excludes_notification_recipients()