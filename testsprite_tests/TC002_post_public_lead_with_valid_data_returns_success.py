import requests
import random
import string
import urllib.parse
import json
import sys

BASE_ORIGIN = "http://localhost:8080"
CSRF_URL = f"{BASE_ORIGIN}/sanctum/csrf-cookie"
BASE_API = f"{BASE_ORIGIN}/api"
LEADS_URL = f"{BASE_API}/public/leads"
TIMEOUT = 30


def test_post_public_lead_valid():
    session = requests.Session()
    # Ensure we get a fresh CSRF cookie and session cookie
    resp = session.get(CSRF_URL, timeout=TIMEOUT)
    try:
        assert resp.status_code == 204, f"Expected 204 from csrf-cookie endpoint, got {resp.status_code}"
    except AssertionError:
        # If response contains helpful body, include it in the assertion message
        body = None
        try:
            body = resp.text
        except Exception:
            body = "<no body>"
        raise AssertionError(f"GET {CSRF_URL} returned {resp.status_code}, body: {body}")

    # Extract XSRF-TOKEN cookie and URL-decode it
    raw_xsrf = session.cookies.get("XSRF-TOKEN")
    assert raw_xsrf is not None, "XSRF-TOKEN cookie not set by csrf-cookie endpoint"
    xsrf_token = urllib.parse.unquote(raw_xsrf)

    headers = {
        "X-XSRF-TOKEN": xsrf_token,
        "Origin": BASE_ORIGIN,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    # Generate a phone: +5531 + 8 digits where the first of those 8 is 9 (to satisfy the requirement)
    random_suffix = "9" + "".join(random.choice(string.digits) for _ in range(7))
    phone = f"+5531{random_suffix}"

    payload = {
        "type": "VISITANTE",
        "name": "Teste Visitante",
        "phone": phone,
        "neighborhood": "Bairro Teste",
        "wants_visit": False,
        "wants_cell_group": False,
        "consent": True,
        "website": ""
    }

    created = False
    # Use try-finally to follow cleanup pattern even though public leads do not return an id to delete
    try:
        post_resp = session.post(LEADS_URL, headers=headers, data=json.dumps(payload), timeout=TIMEOUT)
        # Validate success status
        assert post_resp.status_code == 201, f"Expected 201, got {post_resp.status_code}, body: {post_resp.text}"

        # Validate response body exactly matches expected envelope
        try:
            body = post_resp.json()
        except ValueError:
            raise AssertionError(f"Response is not valid JSON: {post_resp.text}")

        expected = {"data": {"received": True}}
        assert body == expected, f"Response JSON did not match expected. Got: {body}, Expected: {expected}"

        created = True
    except requests.RequestException as e:
        raise AssertionError(f"Request to POST {LEADS_URL} failed: {e}")
    finally:
        # No deletion endpoint for public leads is specified in PRD.
        # Still include a cleanup block to satisfy the test pattern.
        # If there were an admin/delete endpoint, it would be called here with the created resource identifier.
        if created:
            # best-effort noop cleanup placeholder
            pass


if __name__ == "__main__":
    try:
        test_post_public_lead_valid()
        print("TC002 passed")
    except AssertionError as e:
        print("TC002 failed:", e)
        sys.exit(1)
    except Exception as e:
        print("TC002 encountered an unexpected error:", e)
        sys.exit(2)