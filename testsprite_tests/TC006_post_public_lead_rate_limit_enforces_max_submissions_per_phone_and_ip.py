import requests
import urllib.parse
import random
import time
import sys

BASE_API = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
TIMEOUT = 30


def generate_random_visitante_payload(phone=None):
    if phone is None:
        # +5531 + 8 digits starting with 9 -> produce '9' + 7 random digits
        suffix = "9" + "".join(random.choices("0123456789", k=7))
        phone = "+5531" + suffix
    return {
        "type": "VISITANTE",
        "name": "Test Visitor",
        "phone": phone,
        "neighborhood": "Centro",
        "wants_visit": True,
        "wants_cell_group": False,
        "consent": True,
        "website": ""
    }


def get_xsrf_token_from_session(sess):
    xsrf_raw = sess.cookies.get("XSRF-TOKEN")
    if not xsrf_raw:
        return None
    return urllib.parse.unquote(xsrf_raw)


def post_lead(sess, headers, payload):
    url = f"{BASE_API}/public/leads"
    try:
        resp = sess.post(url, headers=headers, json=payload, timeout=TIMEOUT)
        return resp
    except requests.RequestException as e:
        raise AssertionError(f"Request failed: {e}")


def test_rate_limit_tc006():
    sess = requests.Session()
    # Acquire CSRF cookie
    try:
        resp = sess.get(CSRF_URL, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Failed to GET CSRF cookie: {e}")

    assert resp.status_code == 204, f"Expected 204 from csrf-cookie endpoint, got {resp.status_code}"

    xsrf_token = get_xsrf_token_from_session(sess)
    assert xsrf_token, "XSRF-TOKEN cookie not found after fetching CSRF cookie"

    headers = {
        "X-XSRF-TOKEN": xsrf_token,
        "Origin": "http://localhost:8080",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    created_resources = []  # no ids expected, but keep list for the pattern
    fixed_suffix = "9" + "".join(random.choices("0123456789", k=7))
    fixed_phone = "+5531" + fixed_suffix

    try:
        # 1) Test per-phone rate limit: same phone used for 4 submissions
        for attempt in range(1, 5):
            payload = generate_random_visitante_payload(phone=fixed_phone)
            resp = post_lead(sess, headers, payload)
            if attempt <= 3:
                # Expect success 201
                assert resp.status_code == 201, (
                    f"Attempt {attempt}: expected 201 for allowed submission with same phone, got {resp.status_code}, body={resp.text}"
                )
                try:
                    j = resp.json()
                except ValueError:
                    raise AssertionError(f"Attempt {attempt}: response is not valid JSON: {resp.text}")
                assert isinstance(j, dict) and j.get("data", {}).get("received") is True, (
                    f"Attempt {attempt}: unexpected success body: {j}"
                )
            else:
                # 4th attempt must be rate limited
                assert resp.status_code == 429, (
                    f"Attempt {attempt}: expected 429 on 4th submission with same phone, got {resp.status_code}, body={resp.text}"
                )
                # Retry-After header required
                assert "Retry-After" in resp.headers, "Retry-After header missing on 429 response"
                try:
                    j = resp.json()
                except ValueError:
                    raise AssertionError(f"Attempt {attempt}: 429 response is not valid JSON: {resp.text}")
                assert "error" in j, f"Expected error envelope in 429 response, got: {j}"

        # 2) Test per-IP behavior by submitting additional unique-phone leads up to allowable count
        # We have already made 4 submissions. To stay within the instruction limit of at most 8 submissions,
        # perform up to 4 more submissions with distinct phones. If a 429 is encountered, ensure Retry-After header present.
        additional_allowed = 4
        for i in range(additional_allowed):
            payload = generate_random_visitante_payload()
            resp = post_lead(sess, headers, payload)
            if resp.status_code == 201:
                try:
                    j = resp.json()
                except ValueError:
                    raise AssertionError(f"Additional attempt {i+1}: response is not valid JSON: {resp.text}")
                assert j.get("data", {}).get("received") is True, f"Additional attempt {i+1}: unexpected success body: {j}"
            elif resp.status_code == 429:
                # If the IP-based limit is reached within our attempts, ensure Retry-After header exists and envelope is present
                assert "Retry-After" in resp.headers, "Retry-After header missing on 429 response"
                try:
                    j = resp.json()
                except ValueError:
                    raise AssertionError(f"Additional attempt {i+1}: 429 response is not valid JSON: {resp.text}")
                assert "error" in j, f"Expected error envelope in 429 response, got: {j}"
                # Once 429 is seen for IP, stop further attempts
                break
            else:
                raise AssertionError(
                    f"Additional attempt {i+1}: unexpected status code {resp.status_code}, body={resp.text}"
                )

    finally:
        # No resource id is returned by POST /api/public/leads, so nothing to delete.
        # Following the required try-finally pattern: if there were deletable IDs, they'd be removed here.
        pass


if __name__ == "__main__":
    try:
        test_rate_limit_tc006()
        print("TC006 passed")
    except AssertionError as e:
        print(f"TC006 failed: {e}", file=sys.stderr)
        sys.exit(1)