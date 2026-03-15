"""Simple in-memory metrics (optional: export to Redis or Prometheus later)."""
from threading import Lock

_counts: dict[str, int] = {}
_lock = Lock()


def increment(name: str, value: int = 1) -> None:
    with _lock:
        _counts[name] = _counts.get(name, 0) + value


def get_counts() -> dict[str, int]:
    with _lock:
        return dict(_counts)
