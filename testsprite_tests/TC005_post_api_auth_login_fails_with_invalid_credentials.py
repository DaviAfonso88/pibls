import requests
import urllib.parse
import sys

BASE_URL = "http://localhost:8080"
TIMEOUT = 60  # server answers slowly (3-8s); use >= 60s per instructions

def test_post_api_auth_login_invalid_credentials():
    session = requests.Session()
    try:
        # 1) Obtain CSRF cookie
        csrf_url = f"{BASE_URL}/sanctum/csrf-cookie"
        try:
            r = session.get(csrf_url, timeout=TIMEOUT)
        except requests.exceptions.RequestException as e:
            raise AssertionError(f"Failed to GET CSRF cookie endpoint: {e}") from e

        assert r.status_code == 204, f"Expected 204 from {csrf_url}, got {r.status_code}, body: {r.text}"

        # Extract XSRF-TOKEN cookie (URL-decoded)
        xsrf_cookie = session.cookies.get("XSRF-TOKEN")
        assert xsrf_cookie is not None, "XSRF-TOKEN cookie not set by /sanctum/csrf-cookie"
        xsrf_token = urllib.parse.unquote(xsrf_cookie)

        # 2) Perform login with invalid credentials (one attempt only - avoid rate limits)
        login_url = f"{BASE_URL}/api/auth/login"
        payload = {"email": "secretaria@pibls.test", "password": "wrong-password-should-fail"}
        headers = {
            "X-XSRF-TOKEN": xsrf_token,
            "Accept": "application/json",
            "Origin": BASE_URL,
            "Referer": f"{BASE_URL}/"
        }

        try:
            resp = session.post(login_url, json=payload, headers=headers, timeout=TIMEOUT)
        except requests.exceptions.RequestException as e:
            raise AssertionError(f"Failed to POST to login endpoint: {e}") from e

        # Expected: 422 validation error for wrong credentials
        if resp.status_code == 429:
            raise AssertionError("Received 429 Too Many Requests - rate limit reached; ensure not sending more than 3 failed logins in a row")

        assert resp.status_code == 422, f"Expected HTTP 422 for invalid credentials, got {resp.status_code}. Response body: {resp.text}"

        # Validate JSON envelope structure: {"error": {"code", "message", "details", "traceId"}}
        try:
            data = resp.json()
        except ValueError as e:
            raise AssertionError(f"Response is not valid JSON: {e}. Raw body: {resp.text}") from e

        assert isinstance(data, dict), f"Expected JSON object in response, got: {type(data)}"
        assert "error" in data, f"Expected top-level 'error' key in response JSON. Got: {data.keys()}"

        error_obj = data["error"]
        assert isinstance(error_obj, dict), f"'error' should be an object/dict, got: {type(error_obj)}"
        required_keys = {"code", "message", "details", "traceId"}
        missing = required_keys - set(error_obj.keys())
        assert not missing, f"Error object missing keys: {missing}. Present keys: {list(error_obj.keys())}"

        # Must NOT reveal whether the e-mail exists — ensure the message does not contain the email address
        message = str(error_obj.get("message", "")).lower()
        assert "secretaria@pibls.test" not in message, "Error message reveals the e-mail address, which must not happen"

        # If all assertions pass, test succeeded
        print("TC005 passed: POST /api/auth/login with invalid credentials returned HTTP 422 with proper error envelope.")
    finally:
        session.close()

if __name__ == "__main__":
    try:
        test_post_api_auth_login_invalid_credentials()
    except AssertionError as e:
        print(f"TC005 failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC005 unexpected error: {e}")
        sys.exit(2)
    else:
        sys.exit(0)