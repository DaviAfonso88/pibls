import requests
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
CSRF_URL = "http://localhost:8080/sanctum/csrf-cookie"
TIMEOUT = 30

EXPECTED_ERROR_CODE = "INVALID_CREDENTIALS"
EXPECTED_ERROR_MESSAGE = "E-mail ou senha inválidos."
EXPECTED_ERROR_DETAILS = []

def _get_xsrf_token(session):
    resp = session.get(CSRF_URL, timeout=TIMEOUT)
    resp.raise_for_status()
    token = session.cookies.get("XSRF-TOKEN")
    if token is None:
        raise AssertionError("XSRF-TOKEN cookie not present after GET csrf-cookie")
    return urllib.parse.unquote(token)

def perform_login_and_get_error(session, email, password):
    try:
        xsrf = _get_xsrf_token(session)
    except requests.RequestException as e:
        raise AssertionError(f"Failed to GET csrf-cookie: {e}")
    headers = {
        "X-XSRF-TOKEN": xsrf,
        "Origin": "http://localhost:8080",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {"email": email, "password": password}
    try:
        resp = session.post(f"{BASE_API}/auth/login", json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Login request failed: {e}")
    # We expect a 422 response with a specific error structure
    assert resp.status_code == 422, f"Expected status 422 for invalid credentials, got {resp.status_code} (body: {resp.text})"
    try:
        body = resp.json()
    except ValueError:
        raise AssertionError(f"Response is not valid JSON: {resp.text}")
    if "error" not in body:
        raise AssertionError(f"Response JSON missing 'error' key: {body}")
    err = body["error"]
    code = err.get("code")
    message = err.get("message")
    details = err.get("details")
    assert code == EXPECTED_ERROR_CODE, f"Expected error.code '{EXPECTED_ERROR_CODE}', got '{code}'"
    assert message == EXPECTED_ERROR_MESSAGE, f"Expected error.message '{EXPECTED_ERROR_MESSAGE}', got '{message}'"
    assert details == EXPECTED_ERROR_DETAILS, f"Expected error.details {EXPECTED_ERROR_DETAILS}, got {details}"
    # Return standardized error dict without traceId for cross-comparison
    standardized = {"error": {"code": code, "message": message, "details": details}}
    return standardized

def test_login_endpoint_should_return_422_for_invalid_credentials():
    # Per instructions: perform at most once per seeded user; we will test:
    # 1) seeded email with wrong password (admin@pibls.test)
    # 2) made-up email with any password
    # Both must return identical 422 body (ignoring traceId)
    # First: seeded admin with wrong password
    session_admin = requests.Session()
    err_admin = perform_login_and_get_error(session_admin, "admin@pibls.test", "incorrect-password-!23")
    # Second: made-up email
    session_unknown = requests.Session()
    err_unknown = perform_login_and_get_error(session_unknown, "qa-nonexistent-1@example.com", "some-password")
    # Both bodies must be identical (we already standardized to exclude traceId)
    assert err_admin == err_unknown, f"Expected identical error bodies for wrong seeded email and unknown email. Got: {err_admin} vs {err_unknown}"
    print("TC003 passed: both invalid-credential cases returned the expected 422 body.")

if __name__ == "__main__":
    try:
        test_login_endpoint_should_return_422_for_invalid_credentials()
    except AssertionError as e:
        print(f"TC003 failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC003 encountered an unexpected error: {e}")
        sys.exit(2)
    sys.exit(0)