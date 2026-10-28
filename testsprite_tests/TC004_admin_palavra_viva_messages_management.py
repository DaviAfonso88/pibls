import requests
import urllib.parse
import time
import random
import string
import sys

BASE_API = "http://localhost:8080/api"
APP_ORIGIN = "http://localhost:8080"
ADMIN_EMAIL = "comunicacao@pibls.test"
ADMIN_PASSWORD = "Ts-K8M4gH-7o-6S"
NOACCESS_EMAIL = "secretaria@pibls.test"
NOACCESS_PASSWORD = "Ts-K8M4gH-7o-6S"
REQUEST_TIMEOUT = 30  # seconds

def _random_suffix(n=6):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=n))

def _obtain_xsrf_token_and_login(session, email, password):
    # obtain CSRF cookie
    r = session.get(f"{APP_ORIGIN}/sanctum/csrf-cookie", timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    raw = session.cookies.get("XSRF-TOKEN")
    if raw is None:
        raise RuntimeError("XSRF-TOKEN cookie not found after CSRF request")
    xsrf = urllib.parse.unquote(raw)
    headers = {"X-XSRF-TOKEN": xsrf, "Accept": "application/json"}
    payload = {"email": email, "password": password}
    r = session.post(f"{BASE_API}/auth/login", json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
    # Accept either 200 or 204 as login success depending on API; raise otherwise
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"Login failed for {email}: {r.status_code} {r.text}")
    # After login the server may rotate or reset the XSRF cookie; re-read it and update header
    raw_after = session.cookies.get("XSRF-TOKEN")
    if raw_after is not None:
        xsrf_after = urllib.parse.unquote(raw_after)
        headers["X-XSRF-TOKEN"] = xsrf_after
    return headers

def _find_message_by_title(session, title):
    # Try listing admin messages and find by title
    r = session.get(f"{BASE_API}/admin/palavra-viva", timeout=REQUEST_TIMEOUT)
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except Exception:
        return None
    items = data if isinstance(data, list) else data.get("data") or data.get("items") or []
    for it in items:
        # match on common keys
        t = it.get("title") or it.get("titulo") or it.get("titulo_str") or it.get("titulo_pt") or it.get("titulo_raw")
        if t == title:
            return it
    return None

def test_admin_palavra_viva_messages_management():
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    created_id = None
    created_slug = None
    try:
        # 1) Login as admin
        headers = _obtain_xsrf_token_and_login(session, ADMIN_EMAIL, ADMIN_PASSWORD)

        # Prepare test data
        unique = _random_suffix()
        title = f"Mensagem TestSprite {unique}"
        preacher = "Pregador Teste"
        # Body contains a script and an image to test sanitization
        raw_body = '<p>Parte permitida</p><script>alert("x")</script><img src="http://example.com/x.jpg" />'
        valid_youtube = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        # 2) Create message - try several payload key variants until success
        create_url = f"{BASE_API}/admin/palavra-viva"
        create_payload_variants = [
            {"title": title, "pregador": preacher, "texto": raw_body, "youtube": valid_youtube, "publish": True},
            {"titulo": title, "pregador": preacher, "texto": raw_body, "youtube": valid_youtube, "publicar": True},
            {"title": title, "pregador": preacher, "body": raw_body, "youtube_url": valid_youtube, "publish_now": True},
            {"title": title, "author": preacher, "content": raw_body, "youtube": valid_youtube, "status": "published"},
        ]
        create_resp = None
        for payload in create_payload_variants:
            try:
                r = session.post(create_url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
            except requests.RequestException as e:
                raise RuntimeError(f"Request to create message failed: {e}")
            if r.status_code in (200, 201):
                create_resp = r
                break
            # If 422, try next variant; if 403, stop and raise (permissions)
            if r.status_code == 403:
                raise AssertionError("Admin user unexpectedly forbidden to create mensagem (403).")
        assert create_resp is not None, f"Failed to create message; last status {r.status_code} body: {r.text}"

        # parse created record
        try:
            created_json = create_resp.json()
        except Exception:
            created_json = {}
        created_id = created_json.get("id") or created_json.get("data", {}).get("id") if isinstance(created_json, dict) else None
        created_slug = created_json.get("slug") or created_json.get("data", {}).get("slug") if isinstance(created_json, dict) else None

        # If API did not return id/slug, try to find it via listing
        if not created_id:
            found = _find_message_by_title(session, title)
            assert found, "Created message not found in listing"
            created_id = found.get("id") or found.get("ID") or found.get("pk")
            created_slug = found.get("slug") or found.get("endereco") or found.get("path")

        assert created_id, "Could not determine created message id"

        # 3) Retrieve the created message via admin GET or public GET and verify sanitization
        # Try admin endpoint first
        get_admin_url = f"{BASE_API}/admin/palavra-viva/{created_id}"
        r = session.get(get_admin_url, headers=headers, timeout=REQUEST_TIMEOUT)
        if r.status_code not in (200, 201):
            # fallback to public endpoint by slug
            if not created_slug:
                # try to fetch listing to obtain slug
                found = _find_message_by_title(session, title)
                created_slug = found.get("slug") if found else None
            assert created_slug, "No slug available to query public endpoint"
            r = session.get(f"{BASE_API}/palavra-viva/{created_slug}", timeout=REQUEST_TIMEOUT)
            assert r.status_code == 200, f"Failed to retrieve message via public endpoint: {r.status_code}"
        else:
            # ok admin get succeeded
            pass

        # Inspect returned body for sanitization: must not contain <script
        try:
            got = r.json()
        except Exception:
            got = {}
        # body may be under different keys
        body_text = got.get("texto") or got.get("body") or got.get("content") or got.get("data", {}).get("texto") if isinstance(got, dict) else None
        if isinstance(body_text, dict):
            # sometimes rich text may be nested
            body_text = body_text.get("html") or body_text.get("raw") or str(body_text)
        body_text = body_text or ""
        assert "<script" not in body_text.lower(), "Body contains a script tag; sanitization failed"
        # images may be stripped; ensure that script was removed and some allowed text remains
        assert "Parte permitida" in body_text or "Parte permitida".lower() in body_text.lower(), "Allowed body text missing after sanitization"

        # 4) Test YouTube URL validation: attempt to create with invalid youtube link -> expect 422
        invalid_payload = {"title": f"{title}-invalidyt", "pregador": preacher, "texto": "texto curto", "youtube": "https://example.com/notyoutube"}
        r = session.post(create_url, json=invalid_payload, headers=headers, timeout=REQUEST_TIMEOUT)
        assert r.status_code == 422 or (r.status_code == 400), f"Invalid YouTube accepted or unexpected status: {r.status_code} {r.text}"
        # Optionally check for Portuguese validation message
        if r.status_code == 422:
            try:
                err = r.json()
                err_str = str(err)
                assert "YouTube" in err_str or "Informe um link do YouTube" in err_str or "youtube" in err_str.lower()
            except Exception:
                pass

        # 5) Duplicate slug detection: attempt to create another message with same title -> expect 422
        dup_payload = {"title": title, "pregador": preacher, "texto": "dup check", "youtube": valid_youtube}
        r = session.post(create_url, json=dup_payload, headers=headers, timeout=REQUEST_TIMEOUT)
        assert r.status_code == 422, f"Duplicate slug/title creation did not fail as expected; status {r.status_code} body: {r.text}"

        # 6) Update the created message: change title and body
        new_title = title + " (edit)"
        update_payload_variants = [
            {"title": new_title, "texto": "<p>Edited body</p>"},
            {"titulo": new_title, "texto": "<p>Edited body</p>"},
            {"title": new_title, "body": "<p>Edited body</p>"},
        ]
        update_url = f"{BASE_API}/admin/palavra-viva/{created_id}"
        update_resp = None
        for payload in update_payload_variants:
            r = session.put(update_url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
            if r.status_code in (200, 201, 204):
                update_resp = r
                break
            # Try PATCH as fallback
            r = session.patch(update_url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
            if r.status_code in (200, 201, 204):
                update_resp = r
                break
        assert update_resp is not None, f"Failed to update message; last status {r.status_code} body: {r.text}"

        # Verify update by fetching
        r = session.get(update_url, headers=headers, timeout=REQUEST_TIMEOUT)
        assert r.status_code == 200, f"Failed to fetch updated message: {r.status_code}"
        try:
            updated = r.json()
        except Exception:
            updated = {}
        got_title = updated.get("title") or updated.get("titulo") or updated.get("data", {}).get("title")
        assert new_title == got_title or new_title in str(updated), "Updated title not reflected"

        # 7) Permission enforcement: sign in as no-access user and attempt create -> expect 403
        no_access_session = requests.Session()
        no_access_session.headers.update({"Accept": "application/json"})
        _obtain_xsrf_token_and_login(no_access_session, NOACCESS_EMAIL, NOACCESS_PASSWORD)
        bad_payload = {"title": f"Forbidden Test {_random_suffix()}", "pregador": preacher, "texto": "texto"}
        r = no_access_session.post(create_url, json=bad_payload, timeout=REQUEST_TIMEOUT)
        assert r.status_code == 403, f"No-access user did not receive 403; status {r.status_code} body: {r.text}"

        # 8) Delete the created message
        del_url = f"{BASE_API}/admin/palavra-viva/{created_id}"
        r = session.delete(del_url, headers=headers, timeout=REQUEST_TIMEOUT)
        assert r.status_code in (200, 202, 204), f"Delete failed: {r.status_code} {r.text}"

        # Verify deletion: GET should now 404 or not find in listing
        r = session.get(del_url, headers=headers, timeout=REQUEST_TIMEOUT)
        assert r.status_code in (404, 410), f"Deleted message still retrievable: {r.status_code} {r.text}"

        # cleanup mark
        created_id = None

        print("TC004 passed successfully.")
    finally:
        # cleanup if leftover
        if created_id:
            try:
                # attempt login as admin if session expired
                try:
                    headers = _obtain_xsrf_token_and_login(session, ADMIN_EMAIL, ADMIN_PASSWORD)
                except Exception:
                    pass
                r = session.delete(f"{BASE_API}/admin/palavra-viva/{created_id}", headers=headers, timeout=REQUEST_TIMEOUT)
                # ignore result
            except Exception:
                pass

if __name__ == "__main__":
    try:
        test_admin_palavra_viva_messages_management()
    except AssertionError as e:
        print("AssertionError:", e)
        sys.exit(1)
    except Exception as e:
        print("Error:", e)
        sys.exit(2)