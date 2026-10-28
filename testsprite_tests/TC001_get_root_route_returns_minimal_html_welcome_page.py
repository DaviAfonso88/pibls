import requests
import sys

BASE_ENDPOINT = "http://localhost:8080"
TIMEOUT = 30  # seconds

def test_get_root_route_returns_minimal_html_welcome_page():
    url = f"{BASE_ENDPOINT.rstrip('/')}/"
    headers = {
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
    }

    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Request to {url} failed: {e}")
        raise

    # Basic assertions about HTTP status and content type
    try:
        assert resp.status_code == 200, f"Expected status 200 but got {resp.status_code}. Response text: {resp.text[:500]}"
        content_type = resp.headers.get("Content-Type", "")
        assert "text/html" in content_type.lower() or "application/xhtml+xml" in content_type.lower(), \
            f"Expected Content-Type to indicate HTML but got '{content_type}'"
        body_lower = resp.text.lower()
        assert ("<!doctype html" in body_lower) or ("<html" in body_lower), \
            "Response body does not appear to be an HTML document"
    except AssertionError as ae:
        print(f"ASSERTION FAILED: {ae}")
        raise

    print("PASS: Root route returned 200 and an HTML welcome page.")

if __name__ == "__main__":
    try:
        test_get_root_route_returns_minimal_html_welcome_page()
    except Exception as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
    sys.exit(0)