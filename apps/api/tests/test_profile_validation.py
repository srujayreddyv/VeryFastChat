"""Tests for profile validation and edge cases."""


# ═══════════════════════════════════════════════════════════
# Profile auto-create on GET
# ═══════════════════════════════════════════════════════════


def test_get_profile_auto_creates_when_missing(client, mock_supabase):
    """Test GET /auth/profile auto-creates a profile if none exists."""
    mock_supabase.auth.add_user("jwt-auto", "user-auto", email="alice@example.com")
    # No profile seeded — should auto-create with default name
    response = client.get(
        "/v1/auth/profile",
        headers={"Authorization": "Bearer jwt-auto"},
    )
    assert response.status_code == 200
    data = response.json()
    # Route calls get_or_create_profile(user_id) without email, so default is "User"
    assert data["display_name"]  # non-empty


# ═══════════════════════════════════════════════════════════
# Avatar URL validation
# ═══════════════════════════════════════════════════════════


def test_update_profile_with_valid_avatar(client, mock_supabase):
    """Test updating profile with a valid HTTPS avatar URL."""
    mock_supabase.auth.add_user("jwt-av1", "user-av1")
    mock_supabase.table("profiles").data.append(
        {
            "id": "user-av1",
            "display_name": "Test",
            "avatar_url": None,
            "created_at": "2025-01-01T00:00:00+00:00",
            "updated_at": "2025-01-01T00:00:00+00:00",
        }
    )
    response = client.post(
        "/v1/auth/profile",
        json={"avatar_url": "https://example.com/avatar.png"},
        headers={"Authorization": "Bearer jwt-av1"},
    )
    assert response.status_code == 200
    assert response.json()["avatar_url"] == "https://example.com/avatar.png"


def test_update_profile_non_https_avatar_rejected(client, mock_supabase):
    """Test updating profile with non-HTTPS avatar URL is rejected."""
    mock_supabase.auth.add_user("jwt-av2", "user-av2")
    mock_supabase.table("profiles").data.append(
        {
            "id": "user-av2",
            "display_name": "Test",
            "avatar_url": None,
            "created_at": "2025-01-01T00:00:00+00:00",
            "updated_at": "2025-01-01T00:00:00+00:00",
        }
    )
    response = client.post(
        "/v1/auth/profile",
        json={"avatar_url": "http://example.com/avatar.png"},
        headers={"Authorization": "Bearer jwt-av2"},
    )
    assert response.status_code == 400
    assert "HTTPS" in response.json()["detail"]


def test_update_profile_avatar_too_long(client, mock_supabase):
    """Test updating profile with avatar URL exceeding 500 chars is rejected."""
    mock_supabase.auth.add_user("jwt-av3", "user-av3")
    mock_supabase.table("profiles").data.append(
        {
            "id": "user-av3",
            "display_name": "Test",
            "avatar_url": None,
            "created_at": "2025-01-01T00:00:00+00:00",
            "updated_at": "2025-01-01T00:00:00+00:00",
        }
    )
    response = client.post(
        "/v1/auth/profile",
        json={"avatar_url": "https://example.com/" + "a" * 500},
        headers={"Authorization": "Bearer jwt-av3"},
    )
    # Pydantic max_length=500 catches this as 422; service-level check would be 400
    assert response.status_code in (400, 422)


def test_create_profile_display_name_too_long(client, mock_supabase):
    """Test creating profile with display name over 50 chars is rejected."""
    mock_supabase.auth.add_user("jwt-av4", "user-av4")
    response = client.post(
        "/v1/auth/profile",
        json={"display_name": "A" * 51},
        headers={"Authorization": "Bearer jwt-av4"},
    )
    # Pydantic schema allows max 50 chars
    assert response.status_code in (400, 422)
