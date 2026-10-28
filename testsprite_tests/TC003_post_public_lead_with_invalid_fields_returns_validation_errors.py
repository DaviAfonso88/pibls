import requests
import random
import urllib.parse
import sys

BASE_HOST = "http://localhost:8080"
API_BASE = f"{BASE_HOST}/api"
CSRF_URL = f"{BASE_HOST}/sanctum/csrf-cookie"
LEADS_URL = f"{API_BASE}/public/leads"
TIMEOUT = 30.0

def _random_phone():
    return "+55319" + f"{random.randint(0, 99999999):08d}"

def test_tc003_post_public_lead_invalid_fields():
    session = requests.Session()
    try:
        # Get CSRF cookie (expects 204 and sets XSRF-TOKEN)
        r = session.get(CSRF_URL, timeout=TIMEOUT)
        assert r.status_code == 204, f"Expected 204 from csrf-cookie endpoint, got {r.status_code}, body: {r.text}"

        xsrf_cookie = session.cookies.get("XSRF-TOKEN")
        assert xsrf_cookie is not None, "XSRF-TOKEN cookie not found after csrf-cookie request"
        xsrf_token = urllib.parse.unquote(xsrf_cookie)

        headers = {
            "X-XSRF-TOKEN": xsrf_token,
            "Origin": "http://localhost:8080",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # 1) consent false -> 422 with detail on field consent
        phone1 = _random_phone()
        payload1 = {
            "type": "VISITANTE",
            "consent": False,
            "website": "",
            "name": "Test User",
            "phone": phone1,
            "neighborhood": "Test Neighborhood",
            "wants_visit": True,
            "wants_cell_group": False
        }
        resp1 = session.post(LEADS_URL, json=payload1, headers=headers, timeout=TIMEOUT)
        assert resp1.status_code == 422, f"Expected 422 for consent=false, got {resp1.status_code}, body: {resp1.text}"
        data1 = resp1.json()
        assert "error" in data1 and isinstance(data1["error"], dict), f"Expected error envelope in response1, got: {data1}"
        details1 = data1["error"].get("details")
        assert isinstance(details1, list) and len(details1) > 0, f"Expected non-empty error.details in response1, got: {data1}"
        # ensure there's a detail pointing to 'consent'
        if not any(d.get("field") == "consent" for d in details1):
            raise AssertionError(f"No detail for field 'consent' found in response1 details: {details1}")

        # 2) VISITANTE with phone '123' (invalid) -> 422 with detail on field phone
        # Despite global guidance to use random phones, this test specifically requires an invalid phone '123'
        payload2 = {
            "type": "VISITANTE",
            "consent": True,
            "website": "",
            "name": "Invalid Phone User",
            "phone": "123",
            "neighborhood": "Test Neighborhood",
            "wants_visit": False,
            "wants_cell_group": False
        }
        resp2 = session.post(LEADS_URL, json=payload2, headers=headers, timeout=TIMEOUT)
        assert resp2.status_code == 422, f"Expected 422 for invalid phone, got {resp2.status_code}, body: {resp2.text}"
        data2 = resp2.json()
        assert "error" in data2 and isinstance(data2["error"], dict), f"Expected error envelope in response2, got: {data2}"
        details2 = data2["error"].get("details")
        assert isinstance(details2, list) and len(details2) > 0, f"Expected non-empty error.details in response2, got: {data2}"
        if not any(d.get("field") == "phone" for d in details2):
            raise AssertionError(f"No detail for field 'phone' found in response2 details: {details2}")

        # 3) missing type -> 422 and error.details present (preferably a detail with field 'type')
        phone3 = _random_phone()
        payload3 = {
            # "type" omitted intentionally
            "consent": True,
            "website": "",
            "name": "Missing Type User",
            "phone": phone3
        }
        resp3 = session.post(LEADS_URL, json=payload3, headers=headers, timeout=TIMEOUT)
        assert resp3.status_code == 422, f"Expected 422 for missing type, got {resp3.status_code}, body: {resp3.text}"
        data3 = resp3.json()
        assert "error" in data3 and isinstance(data3["error"], dict), f"Expected error envelope in response3, got: {data3}"
        details3 = data3["error"].get("details")
        assert isinstance(details3, list) and len(details3) > 0, f"Expected non-empty error.details in response3, got: {data3}"
        # If possible, ensure there's a 'type' detail; if not, at least ensure details present
        if not any(d.get("field") == "type" for d in details3):
            # Accept other validation details but ensure there is at least one field-specific detail
            if not any(isinstance(d.get("field"), str) and d.get("field") for d in details3):
                raise AssertionError(f"response3.details did not contain any field identifiers: {details3}")

        print("TC003 passed: validation errors returned as expected for all three invalid submissions.")

    except requests.RequestException as e:
        raise AssertionError(f"HTTP request failed: {e}") from e
    finally:
        session.close()

if __name__ == "__main__":
    test_tc003_post_public_lead_invalid_fields()