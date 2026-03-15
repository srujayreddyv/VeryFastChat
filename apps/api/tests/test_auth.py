"""Tests for authentication and profile endpoints."""


# ═══════════════════════════════════════════════════════════
# Auth — JWT Verification
# ═══════════════════════════════════════════════════════════


def test_no_auth_header_is_anonymous(client, mock_supabase):
    """Test requests without Authorization header are treated as anonymous."""
    # Create room without auth — should succeed (anonymous)
    response = client.post("/v1/rooms", json={"display_name": "Anon"})
    assert response.status_code == 200


def test_malformed_auth_header(client, mock_supabase):
    """Test malformed Authorization header returns 401."""
    response = client.post(
        "/v1/rooms",
        json={"display_name": "User"},
        headers={"Authorization": "NotBearer token"},
    )
    assert response.status_code == 401
    assert "Invalid authorization header" in response.json()["detail"]


def test_empty_bearer_token(client, mock_supabase):
    """Test empty Bearer token returns 401."""
    response = client.post(
        "/v1/rooms",
        json={"display_name": "User"},
        headers={"Authorization": "Bearer "},
    )
    assert response.status_code == 401


def test_invalid_jwt_token(client, mock_supabase):
    """Test invalid JWT token returns 401."""
    response = client.post(
        "/v1/rooms",
        json={"display_name": "User"},
        headers={"Authorization": "Bearer fake-invalid-token"},
    )
    assert response.status_code == 401


def test_valid_jwt_sets_user_id(client, mock_supabase):
    """Test valid JWT creates room with user_id set."""
    mock_supabase.auth.add_user("good-token", "user-abc")
    response = client.post(
        "/v1/rooms",
        json={"display_name": "AuthUser"},
        headers={"Authorization": "Bearer good-token"},
    )
    assert response.status_code == 200
    # Room should be created — user_id is set internally
    assert "room_id" in response.json()


# ═══════════════════════════════════════════════════════════
# Profile — GET /v1/auth/profile
# ═══════════════════════════════════════════════════════════


def test_get_profile_unauthenticated(client, mock_supabase):
    """Test getting profile without auth returns 401."""
    response = client.get("/v1/auth/profile")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_get_profile_existing(client, mock_supabase):
    """Test getting an existing profile."""
    mock_supabase.auth.add_user("jwt-1", "user-1")
    mock_supabase.table("profiles").data.append(
        {
            "id": "user-1",
            "display_name": "Alice",
            "avatar_url": "https://example.com/alice.png",
            "created_at": "2025-01-01T00:00:00+00:00",
            "updated_at": "2025-01-01T00:00:00+00:00",
        }
    )
    response = client.get(
        "/v1/auth/profile",
        headers={"Authorization": "Bearer jwt-1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Alice"
    assert data["avatar_url"] == "https://example.com/alice.png"


# ═══════════════════════════════════════════════════════════
# Profile — POST /v1/auth/profile
# ═══════════════════════════════════════════════════════════


def test_create_profile_unauthenticated(client, mock_supabase):
    """Test creating profile without auth returns 401."""
    response = client.post(
        "/v1/auth/profile", json={"display_name": "Bob"}
    )
    assert response.status_code == 401


def test_create_profile_success(client, mock_supabase):
    """Test creating a new profile."""
    mock_supabase.auth.add_user("jwt-2", "user-2")
    response = client.post(
        "/v1/auth/profile",
        json={"display_name": "Bob"},
        headers={"Authorization": "Bearer jwt-2"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Bob"


def test_update_profile_display_name(client, mock_supabase):
    """Test updating display name on existing profile."""
    mock_supabase.auth.add_user("jwt-3", "user-3")
    mock_supabase.table("profiles").data.append(
        {
            "id": "user-3",
            "display_name": "OldName",
            "avatar_url": None,
            "created_at": "2025-01-01T00:00:00+00:00",
            "updated_at": "2025-01-01T00:00:00+00:00",
        }
    )
    response = client.post(
        "/v1/auth/profile",
        json={"display_name": "NewName"},
        headers={"Authorization": "Bearer jwt-3"},
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "NewName"


def test_create_profile_missing_display_name(client, mock_supabase):
    """Test creating profile without display_name returns 400."""
    mock_supabase.auth.add_user("jwt-4", "user-4")
    response = client.post(
        "/v1/auth/profile",
        json={},
        headers={"Authorization": "Bearer jwt-4"},
    )
    assert response.status_code == 400
    assert "display_name" in response.json()["detail"].lower()


# ═══════════════════════════════════════════════════════════
# User Rooms — GET /v1/auth/rooms
# ═══════════════════════════════════════════════════════════


def test_get_user_rooms_unauthenticated(client, mock_supabase):
    """Test getting user rooms without auth returns 401."""
    response = client.get("/v1/auth/rooms")
    assert response.status_code == 401


def test_get_user_rooms_empty(client, mock_supabase):
    """Test getting rooms for user with no rooms."""
    mock_supabase.auth.add_user("jwt-5", "user-5")
    response = client.get(
        "/v1/auth/rooms",
        headers={"Authorization": "Bearer jwt-5"},
    )
    assert response.status_code == 200
    assert response.json()["rooms"] == []


def test_get_user_rooms_with_rooms(client, mock_supabase):
    """Test getting rooms for user who owns rooms."""
    mock_supabase.auth.add_user("jwt-6", "user-6")
    mock_supabase.table("rooms").data.append(
        {
            "id": "room-owned",
            "slug": "my-room",
            "room_name": "My Room",
            "room_image_url": None,
            "status": "active",
            "created_at": "2025-01-01T00:00:00+00:00",
            "user_id": "user-6",
            "expires_at": None,
        }
    )
    response = client.get(
        "/v1/auth/rooms",
        headers={"Authorization": "Bearer jwt-6"},
    )
    assert response.status_code == 200
    rooms = response.json()["rooms"]
    assert len(rooms) == 1
    assert rooms[0]["room_slug"] == "my-room"
    assert rooms[0]["room_name"] == "My Room"
