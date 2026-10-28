import requests
import random
import string
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
LEADS_URL = f"{BASE_API}/public/leads"
TIMEOUT = 30.0

def random_phone():
    # +55319 followed by 8 random digits
    suffix = "".join(random.choices(string.digits, k=8))
    return f"+55319{suffix}"

def get_xsrf_token_from_session(session):
    resp = session.get(CSRF_URL, timeout=TIMEOUT)
    resp.raise_for_status()  # should be 204
    raw = session.cookies.get("XSRF-TOKEN")
    if raw is None:
        raise RuntimeError("XSRF-TOKEN cookie not found after csrf-cookie request")
    # URL-decode the cookie value
    return urllib.parse.unquote(raw)

def assert_success_received(response):
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    try:
        body = response.json()
    except ValueError:
        raise AssertionError(f"Response is not valid JSON: {response.text}")
    expected = {"data": {"received": True}}
    assert body == expected, f"Unexpected response body. Expected {expected}, got {body}"
    # ensure there is no id anywhere in the returned data
    data = body.get("data", {})
    assert "id" not in data, f"Response unexpectedly contains an id: {data}"

def test_TC004_post_public_lead_honeypot_discards_submission():
    session = requests.Session()
    created_ids = []  # if an id is ever returned (PRD says it won't), we would delete in finally

    try:
        # Obtain CSRF cookie and XSRF token
        xsrf = get_xsrf_token_from_session(session)
        headers = {
            "X-XSRF-TOKEN": xsrf,
            "Origin": "http://localhost:8080",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # 1) VISITANTE with website 'spam-link' (honeypot filled) -> should return 201 but be discarded server-side
        payload_honeypot = {
            "type": "VISITANTE",
            "consent": True,
            "website": "spam-link",
            "name": "Test Honeypot",
            "phone": random_phone(),
            "neighborhood": "Bairro Teste",
            "wants_visit": False,
            "wants_cell_group": False
        }

        resp1 = session.post(LEADS_URL, json=payload_honeypot, headers=headers, timeout=TIMEOUT)
        # Validate success envelope and absence of id
        assert_success_received(resp1)
        # If by any chance server returned an id (contrary to PRD), capture it for cleanup
        try:
            body1 = resp1.json()
            data1 = body1.get("data") or {}
            if isinstance(data1, dict) and "id" in data1:
                created_ids.append(data1["id"])
        except Exception:
            pass

        # 2) Valid VISITANTE with website '' -> should return 201 and be processed
        payload_valid = {
            "type": "VISITANTE",
            "consent": True,
            "website": "",
            "name": "Test Valid",
            "phone": random_phone(),
            "neighborhood": "Bairro Teste",
            "wants_visit": True,
            "wants_cell_group": True
        }

        resp2 = session.post(LEADS_URL, json=payload_valid, headers=headers, timeout=TIMEOUT)
        assert_success_received(resp2)
        try:
            body2 = resp2.json()
            data2 = body2.get("data") or {}
            if isinstance(data2, dict) and "id" in data2:
                created_ids.append(data2["id"])
        except Exception:
            pass

    except requests.RequestException as e:
        raise AssertionError(f"Network error during test execution: {e}") from e
    finally:
        # Cleanup any created resources if the API unexpectedly returned ids.
        # According to PRD, the lead endpoint never returns an id, so this should be a no-op.
        for rid in created_ids:
            try:
                # Attempt to delete created resource if such endpoint exists.
                # Use the base API - adjust path if backend exposes a specific delete route.
                delete_url = f"{BASE_API}/public/leads/{rid}"
                # Need to refresh CSRF token and headers for delete if required
                try:
                    xsrf = get_xsrf_token_from_session(session)
                    del_headers = {
                        "X-XSRF-TOKEN": xsrf,
                        "Origin": "http://localhost:8080",
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    }
                except Exception:
                    del_headers = {"Origin": "http://localhost:8080", "Accept": "application/json"}
                session.delete(delete_url, headers=del_headers, timeout=TIMEOUT)
            except Exception:
                # swallow errors in cleanup
                pass

if __name__ == "__main__":
    test_TC004_post_public_lead_honeypot_discards_submission()
    print("TC004 passed")