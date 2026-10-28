import requests
import random
import urllib.parse
import string
from requests.exceptions import RequestException

BASE_ENDPOINT = "http://localhost:8080/api"
CSRF_COOKIE_URL = "http://localhost:8080/sanctum/csrf-cookie"
LEADS_URL = f"{BASE_ENDPOINT}/public/leads"
TIMEOUT = 30.0


def _random_phone():
    # +5531 + 8 digits starting with 9 (so first of the 8 is 9, then 7 random digits)
    return "+5531" + "9" + "".join(random.choice(string.digits) for _ in range(7))


def test_post_public_lead_without_csrf_returns_419():
    session = requests.Session()
    try:
        # Step 1: GET csrf cookie to obtain XSRF-TOKEN and session cookie
        try:
            resp = session.get(CSRF_COOKIE_URL, timeout=TIMEOUT)
        except RequestException as e:
            raise AssertionError(f"Failed to GET CSRF cookie endpoint: {e}")
        assert resp.status_code == 204, f"Expected 204 from csrf-cookie endpoint, got {resp.status_code}"

        # Extract XSRF-TOKEN cookie and URL-decode it
        raw_token = session.cookies.get("XSRF-TOKEN")
        assert raw_token is not None, "XSRF-TOKEN cookie not present after GET /sanctum/csrf-cookie"
        xsrf_token = urllib.parse.unquote(raw_token)

        # Common headers for POST requests (without X-XSRF-TOKEN for the first subtest)
        common_headers = {
            "Origin": "http://localhost:8080",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # Subtest A: Cookies present but X-XSRF-TOKEN header omitted -> expect 419
        payload_a = {
            "type": "VISITANTE",
            "name": "Test Visitor",
            "phone": _random_phone(),
            "neighborhood": "Test Neighborhood",
            "wants_visit": True,
            "wants_cell_group": False,
            "consent": True,
            "website": ""
        }
        try:
            resp_a = session.post(LEADS_URL, json=payload_a, headers=common_headers, timeout=TIMEOUT)
        except RequestException as e:
            raise AssertionError(f"Request failed for missing-header case: {e}")

        assert resp_a.status_code == 419, f"Expected 419 when X-XSRF-TOKEN header is missing, got {resp_a.status_code}"
        try:
            body_a = resp_a.json()
        except ValueError:
            raise AssertionError("Response for missing-header case is not valid JSON")
        assert isinstance(body_a, dict) and "error" in body_a, "Expected error envelope in response when CSRF header missing"

        # Subtest B: No session cookie but header present -> expect 419
        # Clear session cookies to simulate missing session cookie
        session.cookies.clear()

        payload_b = {
            "type": "VISITANTE",
            "name": "Test Visitor 2",
            "phone": _random_phone(),
            "neighborhood": "Another Neighborhood",
            "wants_visit": False,
            "wants_cell_group": True,
            "consent": True,
            "website": ""
        }
        headers_with_token = dict(common_headers)
        headers_with_token["X-XSRF-TOKEN"] = xsrf_token  # send token header but no session cookie

        try:
            resp_b = session.post(LEADS_URL, json=payload_b, headers=headers_with_token, timeout=TIMEOUT)
        except RequestException as e:
            raise AssertionError(f"Request failed for missing-session-cookie case: {e}")

        assert resp_b.status_code == 419, f"Expected 419 when session cookie is missing, got {resp_b.status_code}"
        try:
            body_b = resp_b.json()
        except ValueError:
            raise AssertionError("Response for missing-session-cookie case is not valid JSON")
        assert isinstance(body_b, dict) and "error" in body_b, "Expected error envelope in response when session cookie missing"

    finally:
        session.close()


if __name__ == "__main__":
    test_post_public_lead_without_csrf_returns_419()
    print("TC005 passed.")