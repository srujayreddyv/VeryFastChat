"""Supabase client and DB helpers."""
import hashlib
from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
        )
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
