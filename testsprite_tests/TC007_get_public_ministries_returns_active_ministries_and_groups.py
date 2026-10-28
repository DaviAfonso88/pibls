import requests
import sys
import urllib.parse

BASE = "http://localhost:8080/api"

def test_get_public_ministries_returns_active_ministries_and_groups():
    session = requests.Session()
    url = f"{BASE}/public/ministries"
    headers = {
        "Accept": "application/json",
        "Origin": "http://localhost:8080"
    }
    try:
        resp = session.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    # Basic response checks
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}, body: {resp.text}"
    ct = resp.headers.get("Content-Type", "")
    assert "application/json" in ct, f"Expected JSON response, got Content-Type: {ct}"

    try:
        body = resp.json()
    except ValueError as e:
        raise AssertionError(f"Response body is not valid JSON: {e}; body: {resp.text}")

    # Normalize to the data container if present
    if isinstance(body, dict) and "data" in body:
        data = body["data"]
    else:
        data = body

    # Helper to determine if an object looks like a ministry/group item
    def looks_like_item(obj):
        if not isinstance(obj, dict):
            return False
        # common expected fields: id and name/title
        has_id = any(k in obj for k in ("id", "uuid"))
        has_name = any(k in obj for k in ("name", "title", "label"))
        return has_id and has_name

    ministries = None
    groups = None
    # If data is a dict, try to extract ministries/groups keys
    if isinstance(data, dict):
        # common key names
        for key in ("ministries", "ministry", "items"):
            if key in data and isinstance(data[key], list):
                # prefer explicit ministries/groups if present
                if key == "ministries" or key == "ministry" or key == "items":
                    ministries = data[key]
                    break
        for key in ("groups", "group"):
            if key in data and isinstance(data[key], list):
                groups = data[key]
                break
    # If data is a list, treat it as ministries list
    if isinstance(data, list):
        ministries = data

    # Validate that at least one of ministries or groups is present and non-empty
    found_valid_list = False
    if isinstance(ministries, list) and len(ministries) > 0:
        # ensure items look like ministries
        assert any(looks_like_item(it) for it in ministries), "ministries list items do not have expected fields (id/name)"
        found_valid_list = True

    if isinstance(groups, list) and len(groups) > 0:
        assert any(looks_like_item(it) for it in groups), "groups list items do not have expected fields (id/name)"
        found_valid_list = True

    # As a fallback, if data is a dict containing nested collections, try to discover lists
    if not found_valid_list and isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list) and len(v) > 0 and any(looks_like_item(it) for it in v):
                found_valid_list = True
                break

    # Final fallback: if top-level was a list and looked ok, already handled above
    assert found_valid_list, f"Response JSON did not contain recognizable active ministries or groups. body: {body}"

    print("TC007 passed: GET /api/public/ministries returned active ministries/groups with expected structure.")

if __name__ == "__main__":
    try:
        test_get_public_ministries_returns_active_ministries_and_groups()
    except AssertionError as e:
        print("TC007 failed:", e)
        sys.exit(1)
    except Exception as e:
        print("TC007 unexpected error:", e)
        sys.exit(2)
    sys.exit(0)