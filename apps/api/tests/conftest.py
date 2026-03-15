"""Pytest configuration and fixtures."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import hash_token


@pytest.fixture
def client():
    """Test client for API endpoints."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def mock_supabase(monkeypatch):
    """Mock Supabase client for testing without real database."""

    class MockQuery:
        """Chainable query builder that mimics the Supabase SDK."""

        def __init__(self, rows: list):
            self._rows = rows
            self._filters: dict = {}
            self._is_single = False
            self._is_maybe_single = False
            self._count_mode = False
            self._update_data: dict | None = None
            self._is_delete = False

        # ── column selection ──
        def select(self, fields="*", count=None):
            self._count_mode = count == "exact"
            return self

        # ── mutations ──
        def insert(self, data):
            if isinstance(data, dict):
                self._rows.append(data)
            return self

        def update(self, data):
            self._update_data = data
            return self

        def delete(self):
            self._is_delete = True
            return self

        # ── filters ──
        def eq(self, field, value):
            self._filters[field] = value
            return self

        def is_(self, field, value):
            return self

        def gte(self, field, value):
            return self

        def lt(self, field, value):
            return self

        def order(self, field, desc=False):
            return self

        def limit(self, n):
            return self

        # ── result modifiers ──
        def maybe_single(self):
            self._is_maybe_single = True
            return self

        def single(self):
            self._is_single = True
            return self

        # ── execute ──
        def execute(self):
            filtered = self._apply_filters()

            # Handle update: apply update_data to matching rows
            if self._update_data is not None:
                for row in filtered:
                    row.update(self._update_data)
                return _Response(filtered, count=len(filtered))

            # Handle delete: remove matching rows from source list
            if self._is_delete:
                ids_to_remove = {id(r) for r in filtered}
                self._rows[:] = [r for r in self._rows if id(r) not in ids_to_remove]
                return _Response(filtered, count=len(filtered))

            if self._is_maybe_single or self._is_single:
                row = filtered[0] if filtered else None
                return _Response(row, count=1 if row else 0)

            return _Response(filtered, count=len(filtered))

        # ── internal ──
        def _apply_filters(self):
            rows = self._rows
            for field, value in self._filters.items():
                rows = [r for r in rows if r.get(field) == value]
            return rows

    class _Response:
        def __init__(self, data, count=None):
            self.data = data
            self.count = count

    class MockAuth:
        """Mock Supabase auth for JWT verification."""
        def __init__(self):
            self._users = {}

        def add_user(self, token, user_id, email=None):
            """Register a fake token -> user mapping."""
            self._users[token] = _MockUser(user_id, email)

        def get_user(self, token):
            user = self._users.get(token)
            if not user:
                raise Exception("Invalid token")
            return _MockUserResponse(user)

    class _MockUser:
        def __init__(self, user_id, email=None):
            self.id = user_id
            self.email = email

    class _MockUserResponse:
        def __init__(self, user):
            self.user = user

    class MockTable:
        def __init__(self):
            self.data: list[dict] = []

        def select(self, fields="*", count=None):
            q = MockQuery(self.data)
            return q.select(fields, count)

        def insert(self, data):
            q = MockQuery(self.data)
            return q.insert(data)

        def update(self, data):
            q = MockQuery(self.data)
            q._update_data = data
            return q

        def delete(self):
            q = MockQuery(self.data)
            q._is_delete = True
            return q

    class MockSupabase:
        def __init__(self):
            self.tables: dict[str, MockTable] = {}
            self.auth = MockAuth()

        def table(self, name):
            if name not in self.tables:
                self.tables[name] = MockTable()
            return self.tables[name]

    mock_sb = MockSupabase()

    def mock_get_supabase():
        return mock_sb

    # Patch every module that imports get_supabase
    for module in [
        "app.db",
        "app.main",
        "app.auth",
        "app.routes.rooms",
        "app.routes.profile",
        "app.services.profile",
    ]:
        monkeypatch.setattr(f"{module}.get_supabase", mock_get_supabase)

    return mock_sb


# ── Helper fixtures ──

@pytest.fixture
def host_token():
    """A known host token for testing."""
    return "test-host-token-uuid4"


@pytest.fixture
def host_token_hash(host_token):
    """SHA-256 hash of the test host token."""
    return hash_token(host_token)


@pytest.fixture
def active_room(mock_supabase, host_token_hash):
    """Seed an active room with a host participant and return room data."""
    room = {
        "id": "room-001",
        "slug": "test-room",
        "room_name": "Test Room",
        "room_image_url": "https://example.com/img.png",
        "host_token_hash": host_token_hash,
        "user_id": None,
        "status": "active",
        "expires_at": None,
        "created_at": "2025-01-01T00:00:00+00:00",
    }
    host_participant = {
        "id": "participant-host",
        "room_id": "room-001",
        "session_id": "session-host",
        "display_name": "Host",
        "is_host": True,
        "user_id": None,
    }
    mock_supabase.table("rooms").data.append(room)
    mock_supabase.table("participants").data.append(host_participant)
    return room


@pytest.fixture
def guest_participant(mock_supabase):
    """Add a guest participant to the active room."""
    guest = {
        "id": "participant-guest",
        "room_id": "room-001",
        "session_id": "session-guest",
        "display_name": "Guest",
        "is_host": False,
        "user_id": None,
    }
    mock_supabase.table("participants").data.append(guest)
    return guest


@pytest.fixture
def sample_message(mock_supabase):
    """Add a message from the host to the active room."""
    msg = {
        "id": "msg-001",
        "room_id": "room-001",
        "participant_id": "participant-host",
        "body": "Hello world",
        "created_at": "2025-01-01T00:01:00+00:00",
        "deleted_at": None,
        "participants": {"display_name": "Host"},
    }
    mock_supabase.table("messages").data.append(msg)
    return msg
