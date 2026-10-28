import requests
import time
import urllib.parse
import random
import string
import uuid
from datetime import datetime, timedelta, timezone

BASE_API = "http://localhost:8080/api"
BASE_HOST = "http://localhost:8080"
CSRF_URL = f"{BASE_HOST}/sanctum/csrf-cookie"
TIMEOUT = 120  # seconds
RETRY_ATTEMPTS = 4
RETRY_SLEEP = 5  # seconds


def request_with_retries(session, method, url, **kwargs):
    attempts = 0
    while True:
        try:
            if "timeout" not in kwargs:
                kwargs["timeout"] = TIMEOUT
            resp = session.request(method, url, **kwargs)
            return resp
        except (requests.exceptions.ProxyError, requests.exceptions.ConnectionError) as e:
            attempts += 1
            if attempts >= RETRY_ATTEMPTS:
                raise
            time.sleep(RETRY_SLEEP)


def get_xsrf_token_from_session(session):
    # Obtain CSRF cookie
    resp = request_with_retries(session, "GET", CSRF_URL, allow_redirects=False)
    if resp.status_code not in (200, 204):
        raise AssertionError(f"Failed to get CSRF cookie, status {resp.status_code}")
    raw = session.cookies.get("XSRF-TOKEN")
    if not raw:
        raise AssertionError("XSRF-TOKEN cookie not found after csrf-cookie request")
    return urllib.parse.unquote(raw)


def login_session(email, password):
    session = requests.Session()
    # Get CSRF cookie first
    token = get_xsrf_token_from_session(session)
    headers = {
        "X-XSRF-TOKEN": token,
        "Origin": BASE_HOST,
        "Accept": "application/json",
    }
    # send credentials as top-level fields per API spec
    payload = {"email": email, "password": password}
    resp = request_with_retries(session, "POST", f"{BASE_API}/auth/login", headers=headers, json=payload)
    assert resp.status_code == 200, f"Login failed for {email}: {resp.status_code} {resp.text}"
    return session


def iso_with_offset(dt, hours_offset):
    tz = timezone(timedelta(hours=hours_offset))
    return dt.astimezone(tz).isoformat()


def random_slug(base="msg"):
    suffix = uuid.uuid4().hex[:8]
    return f"{base}-{suffix}"


def test_public_palavra_viva_messages_access_and_seo():
    admin_email = "comunicacao@pibls.test"
    secretaria_email = "secretaria@pibls.test"
    password = "Ts-K8M4gH-7o-6S"

    admin_session = login_session(admin_email, password)
    secretaria_session = login_session(secretaria_email, password)

    created = []  # list of dicts with keys id and slug to delete in finally

    try:
        # Create a published message (published_at in the past)
        admin_xsrf = get_xsrf_token_from_session(admin_session)
        headers = {
            "X-XSRF-TOKEN": admin_xsrf,
            "Origin": BASE_HOST,
            "Accept": "application/json",
        }

        slug_published = random_slug("published")
        title_published = f"Public Test Title {uuid.uuid4().hex[:6]}"
        body_html = "<h2>Heading</h2><p>This is a <strong>published</strong> message for testing.</p>"

        past_dt = datetime.now(timezone.utc) - timedelta(days=1)
        published_at = iso_with_offset(past_dt, -3)

        # API expects top-level JSON fields for creation
        payload_published = {
            "title": title_published,
            "slug": slug_published,
            "body": body_html,
            "author_display": "Tester",
            "published_at": published_at,
        }

        resp = request_with_retries(
            admin_session,
            "POST",
            f"{BASE_API}/admin/palavra-viva",
            headers=headers,
            json=payload_published,
        )
        assert resp.status_code == 201, f"Creating published message failed: {resp.status_code} {resp.text}"
        j = resp.json()
        assert "data" in j and isinstance(j["data"], dict)
        msg_published = j["data"]
        assert msg_published.get("slug") == slug_published
        created.append({"id": msg_published["id"], "slug": slug_published})

        # Create a scheduled message (published_at in the future) to ensure it is not listed publicly
        slug_scheduled = random_slug("scheduled")
        title_scheduled = f"Scheduled Test Title {uuid.uuid4().hex[:6]}"
        future_dt = datetime.now(timezone.utc) + timedelta(days=365)
        scheduled_published_at = iso_with_offset(future_dt, -3)

        payload_scheduled = {
            "title": title_scheduled,
            "slug": slug_scheduled,
            "body": "<p>Scheduled body</p>",
            "author_display": "Scheduler",
            "published_at": scheduled_published_at,
        }

        resp2 = request_with_retries(
            admin_session,
            "POST",
            f"{BASE_API}/admin/palavra-viva",
            headers=headers,
            json=payload_scheduled,
        )
        assert resp2.status_code == 201, f"Creating scheduled message failed: {resp2.status_code} {resp2.text}"
        j2 = resp2.json()
        assert "data" in j2 and isinstance(j2["data"], dict)
        msg_scheduled = j2["data"]
        assert msg_scheduled.get("slug") == slug_scheduled
        created.append({"id": msg_scheduled["id"], "slug": slug_scheduled})

        # Verify secretaria user cannot access admin palavra-viva (expect 403)
        sec_xsrf = get_xsrf_token_from_session(secretaria_session)
        sec_headers = {
            "X-XSRF-TOKEN": sec_xsrf,
            "Origin": BASE_HOST,
            "Accept": "application/json",
        }
        sec_resp = request_with_retries(
            secretaria_session,
            "GET",
            f"{BASE_API}/admin/palavra-viva",
            headers=sec_headers,
        )
        assert sec_resp.status_code == 403, f"Secretaria should get 403 when accessing admin palavra-viva, got {sec_resp.status_code}"

        # Public list: GET /api/public/palavra-viva should list only published messages, without body
        public_list_resp = request_with_retries(requests.Session(), "GET", f"{BASE_API}/public/palavra-viva")
        assert public_list_resp.status_code == 200, f"Public list failed: {public_list_resp.status_code} {public_list_resp.text}"
        pl_json = public_list_resp.json()
        assert "data" in pl_json and isinstance(pl_json["data"], list)
        slugs_in_list = {item.get("slug") for item in pl_json["data"] if "slug" in item}
        assert slug_published in slugs_in_list, "Published message slug not found in public list"
        assert slug_scheduled not in slugs_in_list, "Scheduled message should not appear in public list"

        # Ensure items in public list do not include 'body'
        for item in pl_json["data"]:
            assert "body" not in item, "Public list item must not include body content"

        # GET /api/public/palavra-viva/{slug} for published should return full message with body
        public_detail_resp = request_with_retries(requests.Session(), "GET", f"{BASE_API}/public/palavra-viva/{slug_published}")
        assert public_detail_resp.status_code == 200, f"Public detail for published slug failed: {public_detail_resp.status_code} {public_detail_resp.text}"
        pd_json = public_detail_resp.json()
        assert "data" in pd_json and isinstance(pd_json["data"], dict)
        pd = pd_json["data"]
        assert pd.get("slug") == slug_published
        assert "body" in pd and isinstance(pd["body"], str) and "published" in pd["body"].lower()

        # GET /api/public/palavra-viva/{slug} for scheduled should return 404
        public_scheduled_resp = request_with_retries(requests.Session(), "GET", f"{BASE_API}/public/palavra-viva/{slug_scheduled}")
        assert public_scheduled_resp.status_code == 404, f"Scheduled message detail should be 404, got {public_scheduled_resp.status_code}"

        # Public HTML page for published message: http://localhost:8080/palavra-viva/{slug}
        html_resp = request_with_retries(requests.Session(), "GET", f"{BASE_HOST}/palavra-viva/{slug_published}")
        assert html_resp.status_code == 200, f"HTML page for published slug failed: {html_resp.status_code}"
        html_text = html_resp.text.lower()
        # Check title tag exists
        assert "<title>" in html_text and "</title>" in html_text, "HTML title tag missing"
        # Check og:title and og:description and og:image presence
        assert 'og:title' in html_text, "og:title missing in HTML"
        assert 'og:description' in html_text or 'og:desc' in html_text, "og:description likely missing in HTML"
        assert 'og:image' in html_text, "og:image missing in HTML"
        # Check JSON-LD Article injection
        assert '"@type":"article"' in html_text or '"@type": "article"' in html_text, "JSON-LD Article not found in HTML"
        # Check Cache-Control header includes public and max-age=300
        cache_control = html_resp.headers.get("Cache-Control", "")
        assert "public" in cache_control.lower() and "max-age=300" in cache_control.replace(" ", ""), f"Cache-Control header unexpected: {cache_control}"

        # HTML page for scheduled should be 404
        html_sched_resp = request_with_retries(requests.Session(), "GET", f"{BASE_HOST}/palavra-viva/{slug_scheduled}")
        assert html_sched_resp.status_code == 404, f"HTML page for scheduled slug should be 404, got {html_sched_resp.status_code}"

        # Sitemap: GET /sitemap.xml must include published slug and not scheduled
        sitemap_resp = request_with_retries(requests.Session(), "GET", f"{BASE_HOST}/sitemap.xml")
        assert sitemap_resp.status_code == 200, f"Sitemap request failed: {sitemap_resp.status_code}"
        sitemap_text = sitemap_resp.text
        assert f"/palavra-viva/{slug_published}" in sitemap_text, "Published message slug not found in sitemap.xml"
        assert f"/palavra-viva/{slug_scheduled}" not in sitemap_text, "Scheduled message slug should not be in sitemap.xml"

    finally:
        # Cleanup: delete created messages (soft delete) using admin session
        if created:
            # refresh CSRF token before delete
            try:
                admin_xsrf = get_xsrf_token_from_session(admin_session)
            except Exception:
                admin_xsrf = None
            del_headers = {
                "Origin": BASE_HOST,
                "Accept": "application/json",
            }
            if admin_xsrf:
                del_headers["X-XSRF-TOKEN"] = admin_xsrf

            for rec in created:
                try:
                    resp_del = request_with_retries(admin_session, "DELETE", f"{BASE_API}/admin/palavra-viva/{rec['id']}", headers=del_headers)
                    assert resp_del.status_code == 204, f"Failed to delete message id {rec['id']}: {resp_del.status_code} {resp_del.text}"
                except requests.exceptions.RequestException as e:
                    # If deletion failed due to request issues, raise to surface the error
                    raise


if __name__ == "__main__":
    test_public_palavra_viva_messages_access_and_seo()
    print("TC005 passed.")