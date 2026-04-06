"""
Tests for GET /api/auth/fido-callback

Goal: verify that the redirect URL produced by fido_callback_route
always points to the correct frontend host (server IP) and NEVER
falls back to "localhost" when a proper Origin / Referer header is
provided by the browser.

Run with:
    cd backend
    python -m pytest tests/test_fido_callback.py -v
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Bootstrap a minimal app — we only mount the auth router so we don't
# need the real database / config to be fully wired up.
# ---------------------------------------------------------------------------
from unittest.mock import patch, MagicMock

# Patch heavy side-effects before importing the router
import sys
import os

# Make sure the backend 'src' package is importable when running pytest
# from the backend/ directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ------- mock out everything that touches MongoDB / external services -------
_mock_config = MagicMock()
_mock_config.CLIENT_URL = "https://172.17.35.221:5173"  # matches .env

with (
    patch("src.lib.config.config", _mock_config),
    patch("src.lib.db.connect_db", return_value=None),
    patch("src.middleware.auth_middleware.protect_route", return_value=None),
):
    from src.routes.auth_route import router  # noqa: E402

app = FastAPI()
app.include_router(router)

# Use follow_redirects=False so we can inspect the 302 Location header
client = TestClient(app, follow_redirects=False)

DUMMY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dGVzdA.sig"
SERVER_IP = "172.17.35.221"
SERVER_ORIGIN = f"https://{SERVER_IP}:5173"
SERVER_REFERER = f"https://{SERVER_IP}:5173/some-page"


# ===========================================================================
# Helper
# ===========================================================================

def get_redirect_location(headers: dict) -> str:
    """Call the fido-callback endpoint and return the Location header."""
    resp = client.get(
        f"/api/auth/fido-callback?token={DUMMY_TOKEN}",
        headers=headers,
    )
    assert resp.status_code == 302, (
        f"Expected 302 redirect, got {resp.status_code}: {resp.text}"
    )
    location = resp.headers.get("location", "")
    return location


# ===========================================================================
# 1. Origin header present (primary path)
# ===========================================================================

class TestOriginHeader:
    """When the browser sends an Origin header the route must use it verbatim."""

    def test_redirects_to_server_ip_not_localhost(self):
        location = get_redirect_location({"origin": SERVER_ORIGIN})
        assert "localhost" not in location, (
            f"Redirect went to localhost instead of server IP!\nLocation: {location}"
        )

    def test_redirects_to_correct_server_ip(self):
        location = get_redirect_location({"origin": SERVER_ORIGIN})
        assert SERVER_IP in location, (
            f"Server IP {SERVER_IP} not found in redirect URL.\nLocation: {location}"
        )

    def test_https_scheme_preserved(self):
        location = get_redirect_location({"origin": SERVER_ORIGIN})
        assert location.startswith("https://"), (
            f"Expected https redirect, got: {location}"
        )

    def test_origin_with_explicit_localhost_is_untouched(self):
        """If the desktop app somehow sends origin=localhost the route should
        NOT silently upgrade it to the server IP (it returns exactly what
        Origin says).  This documents the current behaviour so regressions
        surface quickly."""
        location = get_redirect_location({"origin": "http://localhost:5173"})
        # The route echoes back whatever Origin was sent — document this.
        assert "localhost" in location, (
            "Behaviour changed: expected origin=localhost to be echoed back."
        )


# ===========================================================================
# 2. Referer header present, no Origin (fallback #1)
# ===========================================================================

class TestRefererHeader:
    """When Origin is absent but Referer is set, the route must extract the
    correct host from the Referer URL."""

    def test_redirects_to_server_ip_not_localhost(self):
        location = get_redirect_location({"referer": SERVER_REFERER})
        assert "localhost" not in location, (
            f"Redirect went to localhost instead of server IP!\nLocation: {location}"
        )

    def test_redirects_to_correct_server_ip(self):
        location = get_redirect_location({"referer": SERVER_REFERER})
        assert SERVER_IP in location, (
            f"Server IP {SERVER_IP} not found in redirect URL.\nLocation: {location}"
        )

    def test_https_scheme_preserved_from_referer(self):
        location = get_redirect_location({"referer": SERVER_REFERER})
        assert location.startswith("https://"), (
            f"Expected https redirect from Referer, got: {location}"
        )

    def test_path_stripped_from_referer(self):
        """The redirect target should be just the root '/', not carry over
        the page path from the Referer header."""
        location = get_redirect_location({"referer": SERVER_REFERER})
        # Should point to root, not /some-page
        assert location.rstrip("/").endswith(":5173") or location.endswith("/"), (
            f"Path not stripped cleanly from Referer.\nLocation: {location}"
        )

    def test_referer_localhost_stays_localhost(self):
        """Same as Origin: if referer is localhost the route echoes that back."""
        location = get_redirect_location({"referer": "http://localhost:5173/page"})
        assert "localhost" in location


# ===========================================================================
# 3. No Origin, no Referer → falls back to config.CLIENT_URL
# ===========================================================================

class TestFallbackToClientUrl:
    """Without any browser headers the route must use CLIENT_URL from config,
    which must point to the server IP, not localhost."""

    def test_fallback_redirects_to_config_client_url(self):
        location = get_redirect_location({})
        # _mock_config.CLIENT_URL is set to the server IP above
        assert SERVER_IP in location, (
            f"Fallback did not use CLIENT_URL ({SERVER_IP}).\nLocation: {location}"
        )

    def test_fallback_not_localhost(self):
        location = get_redirect_location({})
        assert "localhost" not in location, (
            f"Fallback went to localhost instead of CLIENT_URL!\nLocation: {location}"
        )

    def test_fallback_uses_request_host_when_client_url_is_localhost(self):
        """Regression: if CLIENT_URL is localhost (default), fallback should
        still redirect to the server IP that handled the callback request."""
        with patch("src.lib.config.config.CLIENT_URL", "http://localhost:5173"):
            location = get_redirect_location({"host": f"{SERVER_IP}:3000"})
            assert location == f"http://{SERVER_IP}:5173/", (
                "Fallback did not rewrite localhost to callback request host.\n"
                f"Location: {location}"
            )


# ===========================================================================
# 4. Cookie is always set on the redirect response
# ===========================================================================

class TestCookieAlwaysSet:
    """The JWT cookie must be present regardless of which URL path was chosen."""

    def test_cookie_set_when_origin_provided(self):
        resp = client.get(
            f"/api/auth/fido-callback?token={DUMMY_TOKEN}",
            headers={"origin": SERVER_ORIGIN},
        )
        assert "jwt" in resp.cookies or any(
            "jwt" in h for h in resp.headers.get_list("set-cookie")
        ), "JWT cookie not set in response"

    def test_cookie_set_when_referer_provided(self):
        resp = client.get(
            f"/api/auth/fido-callback?token={DUMMY_TOKEN}",
            headers={"referer": SERVER_REFERER},
        )
        assert "jwt" in resp.cookies or any(
            "jwt" in h for h in resp.headers.get_list("set-cookie")
        ), "JWT cookie not set in response"

    def test_cookie_set_on_fallback(self):
        resp = client.get(f"/api/auth/fido-callback?token={DUMMY_TOKEN}")
        assert "jwt" in resp.cookies or any(
            "jwt" in h for h in resp.headers.get_list("set-cookie")
        ), "JWT cookie not set in response"

    def test_cookie_secure_flag_for_https_origin(self):
        resp = client.get(
            f"/api/auth/fido-callback?token={DUMMY_TOKEN}",
            headers={"origin": SERVER_ORIGIN},
        )
        set_cookie = " ".join(resp.headers.get_list("set-cookie")).lower()
        assert "secure" in set_cookie, (
            "Cookie should be Secure when redirecting to an https origin"
        )


# ===========================================================================
# 5. Missing token → 400
# ===========================================================================

class TestMissingToken:
    def test_missing_token_returns_400(self):
        resp = client.get("/api/auth/fido-callback")
        # FastAPI returns 422 for a missing required query param
        assert resp.status_code in (400, 422), (
            f"Expected 400/422 for missing token, got {resp.status_code}"
        )
