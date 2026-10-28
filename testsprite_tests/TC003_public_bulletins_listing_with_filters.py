import requests
import time
import random
import urllib.parse
from datetime import datetime, timedelta, timezone
from requests.exceptions import ProxyError, ConnectionError

BASE_API = "http://localhost:8080/api"
BASE_HOST = "http://localhost:8080"
CSRF_URL = BASE_HOST + "/sanctum/csrf-cookie"
LOGIN_URL = BASE_API + "/auth/login"
ADMIN_BULLETINS_URL = BASE_API + "/admin/bulletins"
PUBLIC_BULLETINS_URL = BASE_API + "/public/bulletins"

TIMEOUT = 120
RETRIES = 4
RETRY_SLEEP = 5

COMUNICACAO_EMAIL = "comunicacao@pibls.test"
SECRET = "Ts-K8M4gH-7o-6S"

MINIMAL_PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"


def request_with_retries(session, method, url, max_retries=RETRIES, **kwargs):
    attempt = 0
    while True:
        try:
            return session.request(method, url, timeout=TIMEOUT, **kwargs)
        except (ProxyError, ConnectionError) as e:
            attempt += 1
            if attempt >= max_retries:
                raise
            time.sleep(RETRY_SLEEP)


def get_xsrf_token(session):
    # Read XSRF-TOKEN cookie value and URL-decode it for header usage
    raw = session.cookies.get("XSRF-TOKEN")
    if not raw:
        return None
    return urllib.parse.unquote(raw)


def login_with_session(session, email, password):
    # Obtain CSRF cookie
    resp = request_with_retries(session, "get", CSRF_URL, allow_redirects=True)
    assert resp.status_code in (200, 204), f"Expected 200/204 from csrf-cookie, got {resp.status_code}"
    token = get_xsrf_token(session)
    assert token is not None, "XSRF-TOKEN cookie missing after csrf-cookie request"

    headers = {
        "X-XSRF-TOKEN": token,
        "Origin": BASE_HOST,
        "Accept": "application/json",
    }
    # Payload must be top-level according to PRD
    payload = {"email": email, "password": password}
    resp = request_with_retries(session, "post", LOGIN_URL, json=payload, headers=headers)
    assert resp.status_code == 200, f"Login failed with status {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "data" in body, f"Login response missing data: {body}"
    return body["data"]


def create_bulletin(session, edition_number, reference_date, title, published_at=None, summary_text=None):
    # Ensure CSRF cookie present; server may require it for mutating requests
    resp = request_with_retries(session, "get", CSRF_URL, allow_redirects=True)
    assert resp.status_code in (200, 204)
    token = get_xsrf_token(session)
    assert token is not None

    headers = {
        "X-XSRF-TOKEN": token,
        "Origin": BASE_HOST,
        "Accept": "application/json",
    }
    data = {
        "edition_number": str(edition_number),
        "reference_date": reference_date,
        "title": title,
    }
    if summary_text:
        data["summary_text"] = summary_text
    if published_at:
        data["published_at"] = published_at

    files = {
        "pdf": ("boletim.pdf", MINIMAL_PDF, "application/pdf")
    }

    resp = request_with_retries(session, "post", ADMIN_BULLETINS_URL, headers=headers, data=data, files=files)
    assert resp.status_code == 201, f"Create bulletin expected 201, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "data" in body, f"Create bulletin response missing data: {body}"
    return body["data"]


def delete_bulletin(session, bulletin_id):
    # Obtain fresh csrf cookie
    resp = request_with_retries(session, "get", CSRF_URL, allow_redirects=True)
    assert resp.status_code in (200, 204)
    token = get_xsrf_token(session)
    assert token is not None

    headers = {
        "X-XSRF-TOKEN": token,
        "Origin": BASE_HOST,
        "Accept": "application/json",
    }
    url = f"{ADMIN_BULLETINS_URL}/{bulletin_id}"
    resp = request_with_retries(session, "delete", url, headers=headers)
    assert resp.status_code == 204, f"Delete bulletin expected 204, got {resp.status_code}: {resp.text}"


def test_public_bulletins_listing_with_filters():
    session = requests.Session()
    created_ids = []
    try:
        # Login as comunicacao user (has boletins.write)
        login_with_session(session, COMUNICACAO_EMAIL, SECRET)

        # Create a published bulletin (published_at in the past to ensure it's public)
        edition_pub = random.randint(700000, 799999)
        suffix_pub = str(random.randint(100000, 999999))
        title_pub = f"Test Bulletin Published {suffix_pub}"
        reference_date_pub = datetime.utcnow().date().isoformat()  # YYYY-MM-DD
        # published_at in the past to be considered published
        published_at_pub = (datetime.utcnow() - timedelta(days=1)).replace(microsecond=0).isoformat() + "Z"

        published = create_bulletin(
            session,
            edition_number=edition_pub,
            reference_date=reference_date_pub,
            title=title_pub,
            published_at=published_at_pub,
            summary_text="Published for public listing test"
        )
        created_ids.append(published["id"])

        # Create a scheduled bulletin (published_at in the future with explicit -03:00 offset)
        edition_sched = random.randint(700000, 799999)
        # Ensure unique edition
        while edition_sched == edition_pub:
            edition_sched = random.randint(700000, 799999)
        suffix_sched = str(random.randint(100000, 999999))
        title_sched = f"Test Bulletin Scheduled {suffix_sched}"
        reference_date_sched = (datetime.utcnow().date() - timedelta(days=1)).isoformat()
        future_dt = (datetime.utcnow() + timedelta(days=365)).replace(microsecond=0)
        tz_minus3 = timezone(timedelta(hours=-3))
        published_at_sched = future_dt.replace(tzinfo=tz_minus3).isoformat()

        scheduled = create_bulletin(
            session,
            edition_number=edition_sched,
            reference_date=reference_date_sched,
            title=title_sched,
            published_at=published_at_sched,
            summary_text="Scheduled for future"
        )
        created_ids.append(scheduled["id"])

        # Now call public listing without authentication
        # Use a fresh session (no auth required)
        public_session = requests.Session()
        resp = request_with_retries(public_session, "get", PUBLIC_BULLETINS_URL)
        assert resp.status_code == 200, f"Public bulletins expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert "data" in body and isinstance(body["data"], list), f"Unexpected public listing body: {body}"
        editions = [item.get("edition_number") for item in body["data"]]

        # The published bulletin's edition_number must be present
        assert edition_pub in editions, "Published bulletin not found in public listing"
        # The scheduled bulletin must NOT be present
        assert edition_sched not in editions, "Scheduled bulletin should not appear in public listing"

        # Test filtering by year and month for the published bulletin's reference_date
        ref_date = datetime.fromisoformat(reference_date_pub)
        year = ref_date.year
        month = ref_date.month
        url_filtered = f"{PUBLIC_BULLETINS_URL}?year={year}&month={month}"
        resp = request_with_retries(public_session, "get", url_filtered)
        assert resp.status_code == 200, f"Filtered public bulletins expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert "data" in body and isinstance(body["data"], list)
        editions_filtered = [item.get("edition_number") for item in body["data"]]
        assert edition_pub in editions_filtered, "Published bulletin not present in year+month filtered results"

        # Test invalid year -> 422
        resp = request_with_retries(public_session, "get", PUBLIC_BULLETINS_URL + "?year=2200")
        assert resp.status_code == 422, f"Expected 422 for invalid year, got {resp.status_code}"
        err = resp.json()
        assert "error" in err and "code" in err["error"], f"Invalid error structure for invalid year: {err}"

        # Test invalid month -> 422
        resp = request_with_retries(public_session, "get", PUBLIC_BULLETINS_URL + "?year=2026&month=13")
        assert resp.status_code == 422, f"Expected 422 for invalid month, got {resp.status_code}"
        err = resp.json()
        assert "error" in err and "code" in err["error"], f"Invalid error structure for invalid month: {err}"

        # Test month without year -> 422
        resp = request_with_retries(public_session, "get", PUBLIC_BULLETINS_URL + "?month=10")
        assert resp.status_code == 422, f"Expected 422 for month without year, got {resp.status_code}"
        err = resp.json()
        assert "error" in err and "code" in err["error"], f"Invalid error structure for month without year: {err}"

    finally:
        # Cleanup: delete created bulletins (if any)
        # Use the authenticated session to delete via admin endpoint
        for bid in created_ids:
            try:
                delete_bulletin(session, bid)
            except AssertionError as ae:
                # If deletion failed, raise to indicate cleanup problem
                raise
            except Exception:
                # Re-raise unexpected exceptions
                raise


if __name__ == "__main__":
    test_public_bulletins_listing_with_filters()
