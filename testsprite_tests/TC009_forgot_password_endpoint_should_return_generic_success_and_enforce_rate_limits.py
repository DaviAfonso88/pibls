import requests
import urllib.parse
import time
import sys

BASE_API = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
FORGOT_URL = f"{BASE_API}/auth/forgot-password"
TIMEOUT = 30
EXPECTED_MESSAGE = "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha."

def get_xsrf_token(session: requests.Session) -> str:
    resp = session.get(CSRF_URL, timeout=TIMEOUT)
    assert resp.status_code == 204, f"Expected 204 from csrf endpoint, got {resp.status_code}, body: {resp.text}"
    token = session.cookies.get("XSRF-TOKEN")
    assert token is not None, "XSRF-TOKEN cookie not found after csrf-cookie request"
    return urllib.parse.unquote(token)

def post_forgot_password(session: requests.Session, email: str):
    token = get_xsrf_token(session)
    headers = {
        "X-XSRF-TOKEN": token,
        "Origin": "http://localhost:8080",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {"email": email}
    return session.post(FORGOT_URL, headers=headers, json=payload, timeout=TIMEOUT)

def test_forgot_password_endpoint_should_return_generic_success_and_enforce_rate_limits():
    session = requests.Session()

    # Part 1: Per-email rate limit test
    test_email = "qa-teste-1@example.com"
    got_200_count = 0
    got_429_on_fourth = False

    for attempt in range(1, 5):
        try:
            resp = post_forgot_password(session, test_email)
        except requests.RequestException as e:
            raise AssertionError(f"Request failed on attempt {attempt} for per-email test: {e}") from e

        if attempt < 4:
            # Expect success 200 with generic message
            assert resp.status_code == 200, f"Attempt {attempt}: expected 200, got {resp.status_code}, body: {resp.text}"
            try:
                body = resp.json()
            except ValueError:
                raise AssertionError(f"Attempt {attempt}: response not JSON: {resp.text}")
            assert "data" in body and isinstance(body["data"], dict), f"Attempt {attempt}: unexpected body shape: {body}"
            message = body["data"].get("message")
            assert message == EXPECTED_MESSAGE, f"Attempt {attempt}: unexpected message: {message}"
            got_200_count += 1
        else:
            # 4th attempt for same email should be rate-limited (429)
            if resp.status_code == 429:
                got_429_on_fourth = True
            else:
                # It's also acceptable if server enforces a stricter per-IP limit earlier; but the PRD expects 429 on the 4th per-email.
                raise AssertionError(f"Attempt {attempt}: expected 429 for per-email rate limit, got {resp.status_code}, body: {resp.text}")

    assert got_200_count == 3, f"Expected 3 successful requests before rate limit, got {got_200_count}"
    assert got_429_on_fourth, "Did not receive 429 on the 4th forgot-password request for the same email"

    # Part 2: Per-IP rate limit test
    # We'll send requests using distinct emails until we observe a 429, to avoid assuming a fixed starting quota.
    # Stop after max_attempts to avoid infinite loops or excessive requests.
    max_attempts = 20
    ip_test_successes = 0
    ip_test_429_seen = False

    for i in range(1, max_attempts + 1):
        email = f"qa-iptest-{i}@example.com"
        try:
            resp = post_forgot_password(session, email)
        except requests.RequestException as e:
            raise AssertionError(f"Request failed during per-IP test at iteration {i}: {e}") from e

        if resp.status_code == 200:
            # Validate generic success body
            try:
                body = resp.json()
            except ValueError:
                raise AssertionError(f"Per-IP test iter {i}: response not JSON: {resp.text}")
            assert "data" in body and isinstance(body["data"], dict), f"Per-IP iter {i}: unexpected body shape: {body}"
            message = body["data"].get("message")
            assert message == EXPECTED_MESSAGE, f"Per-IP iter {i}: unexpected message: {message}"
            ip_test_successes += 1
            # brief pause to avoid hammering the server too fast
            time.sleep(0.1)
            continue
        elif resp.status_code == 429:
            ip_test_429_seen = True
            break
        else:
            # Unexpected status code - fail fast
            raise AssertionError(f"Per-IP test iter {i}: unexpected status {resp.status_code}, body: {resp.text}")

    assert ip_test_429_seen, f"Per-IP rate limit not triggered within {max_attempts} attempts (saw {ip_test_successes} successes). Expected a 429 when exceeding per-IP limits."

if __name__ == "__main__":
    try:
        test_forgot_password_endpoint_should_return_generic_success_and_enforce_rate_limits()
    except AssertionError as e:
        print("TEST FAILED:", e)
        sys.exit(1)
    except Exception as e:
        print("UNEXPECTED ERROR:", e)
        sys.exit(2)
    print("TEST PASSED")