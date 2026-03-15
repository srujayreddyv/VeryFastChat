"""Rate limiter: Upstash Redis when configured, else in-memory (per key, sliding window)."""
from collections import defaultdict
from datetime import datetime, timezone
from threading import Lock

from app.config import settings

# key -> list of request timestamps (in-memory fallback)
_requests: dict[str, list[datetime]] = defaultdict(list)
_lock = Lock()

LIMITS = {
    "create_room": lambda: (
        settings.create_room_rate_limit,
        settings.rate_limit_window_seconds,
    ),
    "join": lambda: (
        settings.join_rate_limit,
        settings.rate_limit_window_seconds,
    ),
    "send_message": lambda: (
        settings.send_message_rate_limit,
        settings.rate_limit_window_seconds,
    ),
}

_redis = None


def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    if not settings.upstash_redis_rest_url or not settings.upstash_redis_rest_token:
        return None
    try:
        from upstash_redis import Redis
        _redis = Redis(
            url=settings.upstash_redis_rest_url,
            token=settings.upstash_redis_rest_token,
        )
        return _redis
    except Exception:
        return None


def _redis_key(action: str, key: str) -> str:
    return f"ratelimit:{action}:{key}"


def _memory_key(action: str, key: str) -> str:
    return f"{action}:{key}"


def _prune(action: str, key: str, window_seconds: int) -> None:
    now = datetime.now(timezone.utc)
    cutoff = now.timestamp() - window_seconds
    bucket = _memory_key(action, key)
    _requests[bucket] = [t for t in _requests[bucket] if t.timestamp() > cutoff]


def is_rate_limited(action: str, key: str) -> bool:
    if action not in LIMITS:
        return False
    max_req, window_sec = LIMITS[action]()
    redis = _get_redis()
    if redis:
        try:
            rkey = _redis_key(action, key)
            count = redis.incr(rkey)
            if count == 1:
                redis.expire(rkey, window_sec)
            return count > max_req
        except Exception:
            pass
    with _lock:
        _prune(action, key, window_sec)
        return len(_requests[_memory_key(action, key)]) >= max_req


def record_request(action: str, key: str) -> None:
    if action not in LIMITS:
        return
    redis = _get_redis()
    if redis:
        return  # already counted in is_rate_limited via incr
    with _lock:
        _requests[_memory_key(action, key)].append(datetime.now(timezone.utc))
