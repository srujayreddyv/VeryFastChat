"""Signed session cookie (HttpOnly, SameSite=Lax) for room session."""
import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import Response

from app.config import settings

COOKIE_NAME = "vfc_sid"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
COOKIE_SAMESITE = "lax"


def _sign(payload: dict[str, Any]) -> str:
    if not settings.session_secret:
        return ""
    raw = json.dumps(payload, sort_keys=True).encode()
    sig = hmac.new(
        settings.session_secret.encode(),
        raw,
        hashlib.sha256,
    ).hexdigest()
    b64 = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    return f"{b64}.{sig}"


def _verify(value: str) -> dict[str, Any] | None:
    if not settings.session_secret or "." not in value:
        return None
    b64, sig = value.rsplit(".", 1)
    try:
        raw = base64.urlsafe_b64decode(b64 + "==")
    except Exception:
        return None
    expected = hmac.new(
        settings.session_secret.encode(),
        raw,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(raw.decode())
    except Exception:
        return None
    exp = payload.get("e")
    if exp is None or time.time() > exp:
        return None
    return payload


def set_session_cookie(
    response: Response,
    session_id: str,
    room_slug: str,
) -> None:
    """Set HttpOnly signed cookie with session_id and room_slug."""
    if not settings.session_secret:
        return
    exp = int(time.time()) + COOKIE_MAX_AGE
    payload = {"s": session_id, "r": room_slug, "e": exp}
    value = _sign(payload)
    if not value:
        return
    response.set_cookie(
        COOKIE_NAME,
        value,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=settings.api_env == "production",
        path="/",
    )


def read_session_cookie(cookie_header: str | None, room_slug: str) -> str | None:
    """Read and verify cookie; return session_id if valid for this room_slug."""
    if not cookie_header:
        return None
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.lower().startswith(COOKIE_NAME.lower() + "="):
            value = part.split("=", 1)[1].strip().strip('"')
            payload = _verify(value)
            if payload and payload.get("r") == room_slug:
                return payload.get("s")
            return None
    return None
