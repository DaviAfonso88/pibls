import requests
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
BASE_HOST = "http://localhost:8080"
CSRF_URL = f"{BASE_HOST}/sanctum/csrf-cookie"
LOGIN_URL = f"{BASE_API}/auth/login"
ADMIN_USERS_URL = f"{BASE_API}/admin/users"
TIMEOUT = 30

def test_user_write_methods_disabled_returning_404_or_405():
    session = requests.Session()
    try:
        # Get CSRF cookie
        r = session.get(CSRF_URL, timeout=TIMEOUT)
        if r.status_code != 204:
            raise AssertionError(f"Expected 204 from csrf cookie endpoint, got {r.status_code}: {r.text}")

        # Extract XSRF-TOKEN cookie and URL-decode it
        xsrf_token_cookie = session.cookies.get("XSRF-TOKEN")
        if not xsrf_token_cookie:
            raise AssertionError("XSRF-TOKEN cookie not found after CSRF request")
        xsrf_token = urllib.parse.unquote(xsrf_token_cookie)

        # Prepare headers for login and subsequent write requests
        common_headers = {
            "Origin": BASE_HOST,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": xsrf_token
        }

        # Login as admin@pibls.test (has users.read permission)
        login_payload = {"email": "admin@pibls.test", "password": "Ts-v19iCHBnY5NYweUT"}
        r = session.post(LOGIN_URL, json=login_payload, headers=common_headers, timeout=TIMEOUT)
        if r.status_code != 200:
            raise AssertionError(f"Login expected 200, got {r.status_code}: {r.text}")
        try:
            body = r.json()
        except ValueError:
            raise AssertionError(f"Login response is not valid JSON: {r.text}")
        if "data" not in body:
            raise AssertionError(f"Login response does not contain 'data': {body}")

        # Verify we can access admin users (should be allowed for admin)
        r = session.get(ADMIN_USERS_URL, headers={"Accept": "application/json"}, timeout=TIMEOUT)
        if r.status_code != 200:
            raise AssertionError(f"Expected 200 from GET {ADMIN_USERS_URL}, got {r.status_code}: {r.text}")

        # Attempt write methods and expect 404 or 405
        # 1) POST /api/admin/users
        post_payload = {
            "name": "qa-test",
            "email": "qa-teste-1@example.com"
        }
        r_post = session.post(ADMIN_USERS_URL, json=post_payload, headers=common_headers, timeout=TIMEOUT)
        if r_post.status_code not in (404, 405):
            raise AssertionError(f"POST {ADMIN_USERS_URL} expected 404 or 405, got {r_post.status_code}: {r_post.text}")

        # Use an existing id for update/delete attempts (1)
        user_id = 1
        target_url = f"{ADMIN_USERS_URL}/{user_id}"

        # 2) PUT /api/admin/users/1
        put_payload = {
            "name": "changed-name",
            "email": "qa-teste-1@example.com"
        }
        r_put = session.put(target_url, json=put_payload, headers=common_headers, timeout=TIMEOUT)
        if r_put.status_code not in (404, 405):
            raise AssertionError(f"PUT {target_url} expected 404 or 405, got {r_put.status_code}: {r_put.text}")

        # 3) PATCH /api/admin/users/1
        patch_payload = {"name": "patched-name"}
        r_patch = session.patch(target_url, json=patch_payload, headers=common_headers, timeout=TIMEOUT)
        if r_patch.status_code not in (404, 405):
            raise AssertionError(f"PATCH {target_url} expected 404 or 405, got {r_patch.status_code}: {r_patch.text}")

        # 4) DELETE /api/admin/users/1
        r_delete = session.delete(target_url, headers=common_headers, timeout=TIMEOUT)
        if r_delete.status_code not in (404, 405):
            raise AssertionError(f"DELETE {target_url} expected 404 or 405, got {r_delete.status_code}: {r_delete.text}")

        print("TEST PASSED: write methods on /api/admin/users return 404 or 405 as expected.")
    except requests.RequestException as e:
        raise AssertionError(f"Network request failed: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    test_user_write_methods_disabled_returning_404_or_405()