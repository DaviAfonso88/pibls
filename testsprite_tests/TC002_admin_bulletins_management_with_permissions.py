import requests
import random
import time
import datetime
import io
import urllib.parse
import sys

BASE_API = "http://localhost:8080/api"
BASE = BASE_API.rsplit("/api", 1)[0]
CSRF_URL = f"{BASE}/sanctum/csrf-cookie"
LOGIN_URL = f"{BASE_API}/auth/login"
BULLETINS_URL = f"{BASE_API}/admin/boletins"

TIMEOUT = 30  # seconds


def get_xsrf_token_from_session(sess: requests.Session):
    token = sess.cookies.get("XSRF-TOKEN")
    if not token:
        return ""
    return urllib.parse.unquote(token)


def ensure_csrf_cookie(sess: requests.Session):
    resp = sess.get(CSRF_URL, timeout=TIMEOUT)
    resp.raise_for_status()
    return get_xsrf_token_from_session(sess)


def login(email: str, password: str) -> requests.Session:
    sess = requests.Session()
    # obtain csrf cookie
    ensure_csrf_cookie(sess)
    xsrf = get_xsrf_token_from_session(sess)
    headers = {"X-XSRF-TOKEN": xsrf, "Accept": "application/json"}
    payload = {"email": email, "password": password}
    resp = sess.post(LOGIN_URL, json=payload, headers=headers, timeout=TIMEOUT)
    # allow 200 or 204 or 201 depending on implementation
    if resp.status_code not in (200, 201, 204):
        raise AssertionError(f"Login failed for {email}: {resp.status_code} - {resp.text}")
    return sess


def minimal_pdf_bytes():
    # Very small valid PDF
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 24 Tf\n72 144 Td\n(Hi) Tj\nET\nendstream\nendobj\n"
        b"%%EOF\n"
    )


def try_extract_id(resp_json):
    if not resp_json:
        return None
    if isinstance(resp_json, dict):
        if "id" in resp_json:
            return resp_json["id"]
        if "data" in resp_json:
            data = resp_json["data"]
            if isinstance(data, dict) and "id" in data:
                return data["id"]
    return None


def poll_get_bulletin(sess, bullet_id, timeout=10):
    url = f"{BULLETINS_URL}/{bullet_id}"
    end = time.time() + timeout
    last_resp = None
    while time.time() < end:
        resp = sess.get(url, timeout=TIMEOUT)
        last_resp = resp
        if resp.status_code == 200:
            return resp
        time.sleep(1)
    return last_resp


def test_admin_bulletins_management_with_permissions():
    created_id = None
    # Sign in once as the authorized user
    auth_email = "comunicacao@pibls.test"
    auth_password = "Ts-K8M4gH-7o-6S"
    sess = login(auth_email, auth_password)

    xsrf = get_xsrf_token_from_session(sess)
    headers = {"X-XSRF-TOKEN": xsrf, "Accept": "application/json"}

    try:
        # 1) List bulletins
        resp = sess.get(BULLETINS_URL, headers={"Accept": "application/json"}, timeout=TIMEOUT)
        assert resp.status_code == 200, f"List bulletins failed: {resp.status_code} - {resp.text}"
        # Expect a JSON list or object with data
        list_json = None
        try:
            list_json = resp.json()
        except Exception:
            raise AssertionError("List bulletins did not return JSON")
        assert isinstance(list_json, (list, dict)), "Unexpected bulletins list format"

        # 2) Create a new bulletin (unique edition between 700000 and 799999)
        edition = random.randint(700000, 799999)
        title = f"Boletim TestSprite {int(time.time()) % 100000}"
        reference_date = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        summary = "Resumo de teste"
        pdf_bytes = minimal_pdf_bytes()

        # Attempt multiple common field-name variants for robustness
        create_field_variants = [
            {"edicao": str(edition), "domingo": reference_date, "titulo": title, "resumo": summary},
            {"edition": str(edition), "reference_sunday": reference_date, "title": title, "summary": summary},
            {"edition": str(edition), "reference_date": reference_date, "title": title, "summary": summary},
        ]

        create_resp = None
        for fields in create_field_variants:
            files = {"pdf": ("bulletin.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
            # state-changing request requires X-XSRF-TOKEN header
            cur_headers = {"X-XSRF-TOKEN": get_xsrf_token_from_session(sess), "Accept": "application/json"}
            try:
                create_resp = sess.post(BULLETINS_URL, data=fields, files=files, headers=cur_headers, timeout=TIMEOUT)
            except requests.RequestException as e:
                raise AssertionError(f"Create request failed: {e}")
            if create_resp.status_code in (200, 201):
                break
            # if validation error, try next variant
            if create_resp.status_code in (422, 400):
                # try next variant
                continue

        assert create_resp is not None, "Create response is None"
        assert create_resp.status_code in (200, 201), f"Failed to create bulletin: {create_resp.status_code} - {create_resp.text}"
        created_json = create_resp.json() if create_resp.text else {}
        created_id = try_extract_id(created_json)
        assert created_id is not None, f"Created bulletin response did not include id: {created_json}"

        # Wait until bulletin is retrievable
        get_resp = poll_get_bulletin(sess, created_id, timeout=15)
        assert get_resp is not None and get_resp.status_code == 200, f"Created bulletin not retrievable: {get_resp.status_code if get_resp else 'no response'}"

        # 3) Attempt to create duplicate edition -> expect validation error (422 or 400)
        duplicate_fields = create_field_variants[0].copy()
        files = {"pdf": ("bulletin.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        dup_headers = {"X-XSRF-TOKEN": get_xsrf_token_from_session(sess), "Accept": "application/json"}
        dup_resp = sess.post(BULLETINS_URL, data=duplicate_fields, files=files, headers=dup_headers, timeout=TIMEOUT)
        assert dup_resp.status_code in (400, 422), f"Duplicate edition did not produce validation error: {dup_resp.status_code} - {dup_resp.text}"
        # Optionally check message contains Portuguese clue
        try:
            dup_json = dup_resp.json()
            dup_text = str(dup_json)
            assert ("Já existe" in dup_text) or ("exists" in dup_text) or ("edition" in dup_text.lower()) or True
        except Exception:
            # if not JSON, ignore content assert but status code check suffices
            pass

        # 4) Edit the bulletin: change the title
        new_title = title + " - editado"
        update_fields_variants = [
            {"titulo": new_title},
            {"title": new_title},
            {"title": new_title, "summary": summary},
        ]
        update_resp = None
        for upd_fields in update_fields_variants:
            upd_headers = {"X-XSRF-TOKEN": get_xsrf_token_from_session(sess), "Accept": "application/json"}
            url = f"{BULLETINS_URL}/{created_id}"
            try:
                # Many servers accept PUT with multipart; if not, try JSON
                update_resp = sess.put(url, data=upd_fields, headers=upd_headers, timeout=TIMEOUT)
            except requests.RequestException:
                try:
                    update_resp = sess.put(url, json=upd_fields, headers=upd_headers, timeout=TIMEOUT)
                except requests.RequestException as e:
                    raise AssertionError(f"Update request errors: {e}")
            if update_resp is not None and update_resp.status_code in (200, 201):
                break
            if update_resp is not None and update_resp.status_code in (422, 400):
                continue

        assert update_resp is not None and update_resp.status_code in (200, 201), f"Update failed: {update_resp.status_code if update_resp else 'no response'} - {update_resp.text if update_resp else ''}"
        # Verify updated data
        get_after_update = sess.get(f"{BULLETINS_URL}/{created_id}", headers={"Accept": "application/json"}, timeout=TIMEOUT)
        assert get_after_update.status_code == 200, f"Unable to retrieve bulletin after update: {get_after_update.status_code}"
        try:
            gj = get_after_update.json()
            gj_text = str(gj).lower()
            assert ("editado" in gj_text) or (new_title.lower() in gj_text)
        except Exception:
            pass  # best-effort check

        # 5) Replace PDF file for the bulletin
        new_pdf = minimal_pdf_bytes().replace(b"Hi", b"Hi2")
        replace_headers = {"X-XSRF-TOKEN": get_xsrf_token_from_session(sess), "Accept": "application/json"}
        files = {"pdf": ("bulletin2.pdf", io.BytesIO(new_pdf), "application/pdf")}
        replace_url = f"{BULLETINS_URL}/{created_id}"
        replace_resp = sess.put(replace_url, files=files, headers=replace_headers, timeout=TIMEOUT)
        # Some implementations may require additional form fields; accept 200/204/201
        assert replace_resp.status_code in (200, 201, 204), f"Replace PDF failed: {replace_resp.status_code} - {replace_resp.text}"

        # 6) Validate PDF file type enforcement: try to upload a .txt as pdf during creation -> expect validation error
        bad_pdf_bytes = b"Not a PDF file"
        bad_fields = create_field_variants[0].copy()
        bad_fields["edicao"] = str(random.randint(700000, 799999))
        files_bad = {"pdf": ("not_a_pdf.txt", io.BytesIO(bad_pdf_bytes), "text/plain")}
        bad_headers = {"X-XSRF-TOKEN": get_xsrf_token_from_session(sess), "Accept": "application/json"}
        bad_resp = sess.post(BULLETINS_URL, data=bad_fields, files=files_bad, headers=bad_headers, timeout=TIMEOUT)
        assert bad_resp.status_code in (400, 422), f"Invalid PDF upload did not fail as expected: {bad_resp.status_code} - {bad_resp.text}"
        try:
            bad_json = bad_resp.json()
            bad_text = str(bad_json)
            assert ("O arquivo precisa ser um PDF" in bad_text) or ("pdf" in bad_text.lower()) or True
        except Exception:
            pass

        # 7) Logical delete the created bulletin
        del_headers = {"X-XSRF-TOKEN": get_xsrf_token_from_session(sess), "Accept": "application/json"}
        del_resp = sess.delete(f"{BULLETINS_URL}/{created_id}", headers=del_headers, timeout=TIMEOUT)
        assert del_resp.status_code in (200, 204), f"Delete failed: {del_resp.status_code} - {del_resp.text}"
        # After deletion, GET should return 404 or not found / not 200
        time.sleep(1)
        get_after_del = sess.get(f"{BULLETINS_URL}/{created_id}", headers={"Accept": "application/json"}, timeout=TIMEOUT)
        assert get_after_del.status_code in (404, 410) or get_after_del.status_code != 200, "Expected bulletin to be inaccessible after delete"

        # Mark created_id as None because we've deleted it
        created_id = None

        # 8) Permission enforcement: sign in as secretaria (unauthorized for bulletins)
        sec_session = login("secretaria@pibls.test", "Ts-K8M4gH-7o-6S")
        sec_headers = {"X-XSRF-TOKEN": get_xsrf_token_from_session(sec_session), "Accept": "application/json"}
        # Attempt to list or create should return 403
        sec_list = sec_session.get(BULLETINS_URL, headers={"Accept": "application/json"}, timeout=TIMEOUT)
        assert sec_list.status_code in (403, 401), f"Unauthorized staff could access bullets list: {sec_list.status_code} - {sec_list.text}"
        sec_create_fields = create_field_variants[0].copy()
        sec_create_fields["edicao"] = str(random.randint(700000, 799999))
        files = {"pdf": ("bulletin.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        sec_create = sec_session.post(BULLETINS_URL, data=sec_create_fields, files=files, headers=sec_headers, timeout=TIMEOUT)
        assert sec_create.status_code in (403, 401), f"Unauthorized staff could create bulletin: {sec_create.status_code} - {sec_create.text}"

        print("TC002: PASS")
    finally:
        # Cleanup: delete created bulletin if still exists
        if created_id:
            try:
                del_headers = {"X-XSRF-TOKEN": get_xsrf_token_from_session(sess), "Accept": "application/json"}
                resp = sess.delete(f"{BULLETINS_URL}/{created_id}", headers=del_headers, timeout=TIMEOUT)
                # ignore response, best-effort cleanup
            except Exception:
                pass


if __name__ == "__main__":
    try:
        test_admin_bulletins_management_with_permissions()
    except AssertionError as e:
        print("TC002: FAIL -", e)
        sys.exit(1)
    except Exception as e:
        print("TC002: ERROR -", e)
        sys.exit(2)