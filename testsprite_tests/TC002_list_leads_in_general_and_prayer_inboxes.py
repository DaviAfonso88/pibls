import requests
import urllib.parse
import sys

BASE_URL = "http://localhost:8080"
API_BASE = BASE_URL + "/api"
TIMEOUT = 120  # seconds
PASSWORD = "Ts-5alRJbooOoboi0aM"


def login_session(email, password):
    """
    Create a requests.Session, perform CSRF init and login.
    Returns the logged-in session.
    """
    s = requests.Session()
    try:
        # Initialize CSRF cookie
        r = s.get(BASE_URL + "/sanctum/csrf-cookie", timeout=TIMEOUT)
        assert r.status_code == 204, f"Expected 204 from csrf-cookie, got {r.status_code}: {r.text[:200]}"
        # Extract XSRF-TOKEN cookie and URL-decode it for header
        xsrf = s.cookies.get("XSRF-TOKEN")
        if xsrf is None:
            raise AssertionError("XSRF-TOKEN cookie not set by csrf-cookie endpoint")
        xsrf_header = urllib.parse.unquote(xsrf)
        headers = {
            "X-XSRF-TOKEN": xsrf_header,
            "Origin": BASE_URL,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        payload = {"email": email, "password": password}
        r = s.post(API_BASE + "/auth/login", json=payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Login failed for {email}, status {r.status_code}, body: {r.text[:400]}"
        return s
    except Exception:
        # Ensure session closed on failure
        try:
            s.close()
        except Exception:
            pass
        raise


def get_list(session, params):
    headers = {"Accept": "application/json"}
    return session.get(API_BASE + "/admin/leads", params=params, headers=headers, timeout=TIMEOUT)


def run_test_list_leads_in_general_and_prayer_inboxes():
    # Create up to three sessions (admin, secretaria, oracao) and reuse them
    admin_sess = None
    secretaria_sess = None
    oracao_sess = None
    try:
        admin_sess = login_session("admin@pibls.test", PASSWORD)
        secretaria_sess = login_session("secretaria@pibls.test", PASSWORD)
        oracao_sess = login_session("oracao@pibls.test", PASSWORD)

        # 1) Admin: GET inbox=geral -> 200, data structure, meta, items do NOT include message, and no ORACAO type
        r = get_list(admin_sess, {"inbox": "geral"})
        assert r.status_code == 200, f"Expected 200 for admin geral, got {r.status_code}, body: {r.text[:400]}"
        body = r.json()
        assert "data" in body, "Response missing 'data' key for geral"
        assert isinstance(body["data"], list), "'data' is not a list for geral"
        assert "meta" in body, "Response missing 'meta' key for geral"
        meta = body["meta"]
        for item in body["data"]:
            # list must include specific fields and must not include message content
            assert "id" in item, "Lead item missing 'id'"
            assert "type" in item, "Lead item missing 'type'"
            assert "status" in item, "Lead item missing 'status'"
            assert "name" in item, "Lead item missing 'name'"
            assert "phone" in item, "Lead item missing 'phone'"
            assert "created_at" in item, "Lead item missing 'created_at'"
            assert "waiting_days" in item, "Lead item missing 'waiting_days'"
            assert "assigned_to" in item, "Lead item missing 'assigned_to'"
            # Ensure message content is not present in list items
            assert "message" not in item, "Message should not be included in list response"
            # Ensure ORACAO is not present in geral inbox
            assert item.get("type") != "ORACAO", f"Found ORACAO in geral inbox: {item}"
            # waiting_days must be either None or an integer
            wd = item.get("waiting_days")
            assert (wd is None) or isinstance(wd, int), f"waiting_days must be int or null, got {wd}"

        # 2) Admin: GET inbox=oracao -> 200, data items must be ORACAO type
        r = get_list(admin_sess, {"inbox": "oracao"})
        assert r.status_code == 200, f"Expected 200 for admin oracao, got {r.status_code}, body: {r.text[:400]}"
        body = r.json()
        assert "data" in body and isinstance(body["data"], list), "oracao response missing data list"
        for item in body["data"]:
            assert item.get("type") == "ORACAO", f"Non-ORACAO item in oracao inbox: {item}"

        # 3) Admin: test pagination & sorting parameters on geral
        # Request per_page=1 to validate meta.per_page == 1 is honored
        r = get_list(admin_sess, {"inbox": "geral", "per_page": 1, "page": 1, "sort": "-created_at"})
        assert r.status_code == 200, f"Expected 200 for admin geral with pagination, got {r.status_code}, body: {r.text[:400]}"
        body = r.json()
        assert "meta" in body, "Paginated response missing meta"
        meta = body["meta"]
        # per_page may be returned as integer
        assert int(meta.get("per_page", 0)) == 1, f"Expected meta.per_page == 1, got {meta.get('per_page')}"

        # 4) Missing inbox -> 422
        r = get_list(admin_sess, {})  # no inbox param
        assert r.status_code == 422, f"Expected 422 for missing inbox, got {r.status_code}, body: {r.text[:400]}"

        # 5) Unknown inbox -> 422
        r = get_list(admin_sess, {"inbox": "unknown"})
        assert r.status_code == 422, f"Expected 422 for unknown inbox, got {r.status_code}, body: {r.text[:400]}"

        # 6) Unauthorized access: secretaria trying to read oracao -> 403
        r = get_list(secretaria_sess, {"inbox": "oracao"})
        assert r.status_code == 403, f"Expected 403 for secretaria accessing oracao, got {r.status_code}, body: {r.text[:400]}"

        # 7) Unauthorized access: oracao user trying to read geral -> 403
        r = get_list(oracao_sess, {"inbox": "geral"})
        assert r.status_code == 403, f"Expected 403 for oracao user accessing geral, got {r.status_code}, body: {r.text[:400]}"

        # If we reached this point all assertions passed
        print("TC002 passed: list_leads_in_general_and_prayer_inboxes")
    finally:
        # Close sessions
        for sess in (admin_sess, secretaria_sess, oracao_sess):
            try:
                if sess:
                    sess.close()
            except Exception:
                pass


if __name__ == "__main__":
    try:
        run_test_list_leads_in_general_and_prayer_inboxes()
    except AssertionError as e:
        print("AssertionError:", e)
        sys.exit(1)
    except Exception as e:
        print("Error during test execution:", str(e))
        sys.exit(2)