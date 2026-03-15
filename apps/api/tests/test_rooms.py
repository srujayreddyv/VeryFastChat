"""Tests for room endpoints."""
from app.db import hash_token


# ═══════════════════════════════════════════════════════════
# Room Creation
# ═══════════════════════════════════════════════════════════


def test_create_room(client, mock_supabase):
    """Test room creation returns expected fields."""
    response = client.post(
        "/v1/rooms",
        json={"display_name": "TestHost", "expires_in_minutes": 1440},
    )
    assert response.status_code == 200
    data = response.json()
    assert "room_id" in data
    assert "room_slug" in data
    assert "host_token" in data
    assert "share_url" in data
    assert data["expires_at"] is None  # Persistent rooms


def test_create_room_with_custom_name(client, mock_supabase):
    """Test room creation with a custom room name."""
    response = client.post(
        "/v1/rooms",
        json={"display_name": "Host", "room_name": "My Chat Room"},
    )
    assert response.status_code == 200
    assert response.json()["room_name"] == "My Chat Room"


def test_create_room_generates_name_when_empty(client, mock_supabase):
    """Test room creation auto-generates a name when none provided."""
    response = client.post("/v1/rooms", json={"display_name": "Host"})
    assert response.status_code == 200
    assert response.json()["room_name"]  # Should be non-empty


def test_create_room_rate_limit(client, monkeypatch):
    """Test room creation rate limiting."""
    monkeypatch.setattr("app.routes.rooms.is_rate_limited", lambda action, key: True)
    response = client.post("/v1/rooms", json={"display_name": "TestHost"})
    assert response.status_code == 429
    assert "Too many rooms created" in response.json()["detail"]


# ═══════════════════════════════════════════════════════════
# Get Room
# ═══════════════════════════════════════════════════════════


def test_get_room_not_found(client, mock_supabase):
    """Test getting non-existent room."""
    response = client.get("/v1/rooms/nonexistent")
    assert response.status_code == 404
    assert "Room not found" in response.json()["detail"]


def test_get_room_active(client, active_room):
    """Test getting an active room returns full details."""
    response = client.get("/v1/rooms/test-room")
    assert response.status_code == 200
    data = response.json()
    assert data["room_slug"] == "test-room"
    assert data["room_name"] == "Test Room"
    assert data["status"] == "active"
    assert data["participant_count"] >= 1


def test_get_room_locked(client, mock_supabase):
    """Test getting locked room returns details."""
    mock_supabase.table("rooms").data = [
        {"id": "r1", "slug": "locked-room", "room_name": None,
         "room_image_url": None, "status": "locked", "expires_at": None}
    ]
    response = client.get("/v1/rooms/locked-room")
    assert response.status_code == 200
    assert response.json()["status"] == "locked"


def test_get_room_ended(client, mock_supabase):
    """Test getting ended room returns details."""
    mock_supabase.table("rooms").data = [
        {"id": "r1", "slug": "ended-room", "room_name": None,
         "room_image_url": None, "status": "ended", "expires_at": None}
    ]
    response = client.get("/v1/rooms/ended-room")
    assert response.status_code == 200
    assert response.json()["status"] == "ended"


# ═══════════════════════════════════════════════════════════
# Join Room
# ═══════════════════════════════════════════════════════════


def test_join_room_not_found(client, mock_supabase):
    """Test joining non-existent room."""
    response = client.post(
        "/v1/rooms/nonexistent/join", json={"display_name": "User"}
    )
    assert response.status_code == 404


def test_join_room_success(client, active_room):
    """Test successfully joining an active room."""
    response = client.post(
        "/v1/rooms/test-room/join", json={"display_name": "NewUser"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["room_slug"] == "test-room"
    assert data["display_name"] == "NewUser"
    assert data["is_host"] is False
    assert "session_id" in data
    assert "participant_id" in data


def test_join_room_as_host_with_token(client, active_room, host_token):
    """Test joining room with valid host token marks user as host."""
    response = client.post(
        "/v1/rooms/test-room/join",
        json={"display_name": "Host", "host_token": host_token},
    )
    assert response.status_code == 200
    assert response.json()["is_host"] is True


def test_join_room_locked(client, mock_supabase, host_token_hash):
    """Test joining a locked room is rejected."""
    mock_supabase.table("rooms").data = [
        {"id": "r1", "slug": "locked", "user_id": None,
         "host_token_hash": host_token_hash, "status": "locked", "expires_at": None}
    ]
    response = client.post(
        "/v1/rooms/locked/join", json={"display_name": "User"}
    )
    assert response.status_code == 423
    assert "not accepting" in response.json()["detail"]


def test_join_room_rate_limit(client, monkeypatch, active_room):
    """Test join room rate limiting."""
    monkeypatch.setattr("app.routes.rooms.is_rate_limited", lambda action, key: True)
    response = client.post(
        "/v1/rooms/test-room/join", json={"display_name": "User"}
    )
    assert response.status_code == 429
    assert "Too many join attempts" in response.json()["detail"]


# ═══════════════════════════════════════════════════════════
# Messages — Send
# ═══════════════════════════════════════════════════════════


def test_send_message_without_session(client):
    """Test sending message without session returns 401."""
    response = client.post(
        "/v1/rooms/testslug/messages", json={"body": "Hello"}
    )
    assert response.status_code == 401
    assert "Session required" in response.json()["detail"]


def test_send_message_success(client, active_room):
    """Test successfully sending a message."""
    response = client.post(
        "/v1/rooms/test-room/messages",
        json={"body": "Hello world!", "session_id": "session-host"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["body"] == "Hello world!"
    assert data["display_name"] == "Host"
    assert "id" in data
    assert "created_at" in data


def test_send_message_empty_body(client, active_room):
    """Test sending whitespace-only message is rejected."""
    response = client.post(
        "/v1/rooms/test-room/messages",
        json={"body": "   ", "session_id": "session-host"},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_send_message_room_not_found(client, mock_supabase):
    """Test sending message to non-existent room."""
    response = client.post(
        "/v1/rooms/nonexistent/messages",
        json={"body": "Hello", "session_id": "some-session"},
    )
    assert response.status_code == 404


def test_send_message_not_participant(client, active_room):
    """Test sending message with unknown session_id is rejected."""
    response = client.post(
        "/v1/rooms/test-room/messages",
        json={"body": "Hello", "session_id": "unknown-session"},
    )
    assert response.status_code == 403
    assert "Not a participant" in response.json()["detail"]


def test_send_message_locked_room(client, active_room):
    """Test sending message to a locked room is rejected."""
    # Lock the room
    active_room["status"] = "locked"
    response = client.post(
        "/v1/rooms/test-room/messages",
        json={"body": "Hello", "session_id": "session-host"},
    )
    assert response.status_code == 423
    assert "not accepting messages" in response.json()["detail"].lower()


def test_send_message_rate_limit(client, active_room, monkeypatch):
    """Test message sending rate limiting."""
    monkeypatch.setattr("app.routes.rooms.is_rate_limited", lambda action, key: True)
    response = client.post(
        "/v1/rooms/test-room/messages",
        json={"body": "Hello", "session_id": "session-host"},
    )
    assert response.status_code == 429


# ═══════════════════════════════════════════════════════════
# Messages — List
# ═══════════════════════════════════════════════════════════


def test_list_messages_room_not_found(client, mock_supabase):
    """Test listing messages for non-existent room."""
    response = client.get("/v1/rooms/nonexistent/messages")
    assert response.status_code == 404


def test_list_messages_empty(client, active_room):
    """Test listing messages for room with no messages."""
    response = client.get("/v1/rooms/test-room/messages")
    assert response.status_code == 200
    assert response.json() == []


def test_list_messages_with_messages(client, active_room, sample_message):
    """Test listing messages returns message data."""
    response = client.get("/v1/rooms/test-room/messages")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    msg = data[0]
    assert msg["body"] == "Hello world"
    assert msg["display_name"] == "Host"
    assert "id" in msg
    assert "created_at" in msg


# ═══════════════════════════════════════════════════════════
# Messages — Delete
# ═══════════════════════════════════════════════════════════


def test_delete_message_no_session(client, active_room, sample_message):
    """Test deleting message without session returns 401."""
    response = client.delete("/v1/rooms/test-room/messages/msg-001")
    assert response.status_code == 401


def test_delete_own_message(client, active_room, sample_message, monkeypatch):
    """Test author can delete their own message."""
    # Patch read_session_cookie to return the host's session
    monkeypatch.setattr(
        "app.routes.rooms.read_session_cookie",
        lambda cookie, slug: "session-host",
    )
    response = client.delete("/v1/rooms/test-room/messages/msg-001")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_host_can_delete_guest_message(
    client, active_room, guest_participant, mock_supabase, monkeypatch
):
    """Test host can delete another participant's message."""
    # Add a guest message
    mock_supabase.table("messages").data.append(
        {
            "id": "msg-guest",
            "room_id": "room-001",
            "participant_id": "participant-guest",
            "body": "Guest msg",
            "created_at": "2025-01-01T00:02:00+00:00",
            "deleted_at": None,
        }
    )
    # Host session
    monkeypatch.setattr(
        "app.routes.rooms.read_session_cookie",
        lambda cookie, slug: "session-host",
    )
    response = client.delete("/v1/rooms/test-room/messages/msg-guest")
    assert response.status_code == 200


def test_guest_cannot_delete_host_message(
    client, active_room, guest_participant, sample_message, monkeypatch
):
    """Test non-host cannot delete another user's message."""
    monkeypatch.setattr(
        "app.routes.rooms.read_session_cookie",
        lambda cookie, slug: "session-guest",
    )
    response = client.delete("/v1/rooms/test-room/messages/msg-001")
    assert response.status_code == 403
    assert "Cannot delete" in response.json()["detail"]


def test_delete_nonexistent_message(client, active_room, monkeypatch):
    """Test deleting a message that doesn't exist returns 404."""
    monkeypatch.setattr(
        "app.routes.rooms.read_session_cookie",
        lambda cookie, slug: "session-host",
    )
    response = client.delete("/v1/rooms/test-room/messages/no-such-msg")
    assert response.status_code == 404


# ═══════════════════════════════════════════════════════════
# Moderation — Lock
# ═══════════════════════════════════════════════════════════


def test_lock_room_success(client, active_room, host_token):
    """Test host can lock an active room."""
    response = client.post(
        "/v1/rooms/test-room/moderation/lock",
        json={"host_token": host_token},
    )
    assert response.status_code == 200
    assert "locked" in response.json()["message"].lower()


def test_lock_room_invalid_token(client, active_room):
    """Test locking room with invalid host token is rejected."""
    response = client.post(
        "/v1/rooms/test-room/moderation/lock",
        json={"host_token": "wrong-token"},
    )
    assert response.status_code == 403
    assert "Invalid host credentials" in response.json()["detail"]


def test_lock_room_already_locked(client, active_room, host_token):
    """Test locking an already-locked room is idempotent."""
    active_room["status"] = "locked"
    response = client.post(
        "/v1/rooms/test-room/moderation/lock",
        json={"host_token": host_token},
    )
    assert response.status_code == 200
    assert "already locked" in response.json()["message"].lower()


def test_lock_room_not_found(client, mock_supabase):
    """Test locking non-existent room."""
    response = client.post(
        "/v1/rooms/nonexistent/moderation/lock",
        json={"host_token": "any"},
    )
    assert response.status_code == 404


# ═══════════════════════════════════════════════════════════
# Moderation — Unlock
# ═══════════════════════════════════════════════════════════


def test_unlock_room_success(client, active_room, host_token):
    """Test host can unlock a locked room."""
    active_room["status"] = "locked"
    response = client.post(
        "/v1/rooms/test-room/moderation/unlock",
        json={"host_token": host_token},
    )
    assert response.status_code == 200
    assert "unlocked" in response.json()["message"].lower()


def test_unlock_room_not_locked(client, active_room):
    """Test unlocking a room that is not locked is idempotent."""
    response = client.post(
        "/v1/rooms/test-room/moderation/unlock",
        json={"host_token": "some-token"},
    )
    assert response.status_code == 200
    assert "not locked" in response.json()["message"]


def test_unlock_room_invalid_token(client, active_room, host_token):
    """Test unlocking room with invalid host token is rejected."""
    active_room["status"] = "locked"
    response = client.post(
        "/v1/rooms/test-room/moderation/unlock",
        json={"host_token": "wrong-token"},
    )
    assert response.status_code == 403
    assert "Invalid host credentials" in response.json()["detail"]


# ═══════════════════════════════════════════════════════════
# Moderation — End Room
# ═══════════════════════════════════════════════════════════


def test_end_room_success(client, active_room, host_token):
    """Test host can end and delete a room."""
    response = client.post(
        "/v1/rooms/test-room/moderation/end",
        json={"host_token": host_token},
    )
    assert response.status_code == 200
    assert "ended" in response.json()["message"].lower()


def test_end_room_invalid_token(client, active_room):
    """Test ending room with invalid host token is rejected."""
    response = client.post(
        "/v1/rooms/test-room/moderation/end",
        json={"host_token": "wrong-token"},
    )
    assert response.status_code == 403
    assert "Invalid host credentials" in response.json()["detail"]


def test_end_room_not_found(client, mock_supabase):
    """Test ending non-existent room."""
    response = client.post(
        "/v1/rooms/nonexistent/moderation/end",
        json={"host_token": "any"},
    )
    assert response.status_code == 404


# ═══════════════════════════════════════════════════════════
# Dual Host Verification (authenticated user)
# ═══════════════════════════════════════════════════════════


def test_lock_room_authenticated_host(client, mock_supabase, host_token_hash):
    """Test authenticated user can lock their own room via user_id."""
    mock_supabase.auth.add_user("valid-jwt", "user-123")
    mock_supabase.table("rooms").data = [
        {"id": "r1", "slug": "auth-room", "room_name": "Auth Room",
         "room_image_url": None, "host_token_hash": host_token_hash,
         "user_id": "user-123", "status": "active", "expires_at": None}
    ]
    response = client.post(
        "/v1/rooms/auth-room/moderation/lock",
        json={"host_token": "doesnt-matter"},
        headers={"Authorization": "Bearer valid-jwt"},
    )
    assert response.status_code == 200
    assert "locked" in response.json()["message"].lower()


def test_end_room_authenticated_host(client, mock_supabase, host_token_hash):
    """Test authenticated user can end their own room via user_id."""
    mock_supabase.auth.add_user("valid-jwt", "user-456")
    mock_supabase.table("rooms").data = [
        {"id": "r2", "slug": "auth-room-2", "room_name": None,
         "room_image_url": None, "host_token_hash": host_token_hash,
         "user_id": "user-456", "status": "active", "expires_at": None}
    ]
    response = client.post(
        "/v1/rooms/auth-room-2/moderation/end",
        json={"host_token": "doesnt-matter"},
        headers={"Authorization": "Bearer valid-jwt"},
    )
    assert response.status_code == 200


# ═══════════════════════════════════════════════════════════
# Input Validation
# ═══════════════════════════════════════════════════════════


def test_create_room_display_name_too_long(client, mock_supabase):
    """Test display name exceeding max length is rejected."""
    response = client.post(
        "/v1/rooms", json={"display_name": "A" * 33}
    )
    assert response.status_code == 422  # Pydantic validation


def test_create_room_display_name_empty(client, mock_supabase):
    """Test empty display name is rejected."""
    response = client.post("/v1/rooms", json={"display_name": ""})
    assert response.status_code == 422


def test_send_message_body_too_long(client, active_room):
    """Test message body exceeding 2000 chars is rejected."""
    response = client.post(
        "/v1/rooms/test-room/messages",
        json={"body": "A" * 2001, "session_id": "session-host"},
    )
    assert response.status_code == 422


def test_send_message_control_chars_rejected(client, active_room):
    """Test message body with null bytes is rejected."""
    response = client.post(
        "/v1/rooms/test-room/messages",
        json={"body": "hello\x00world", "session_id": "session-host"},
    )
    assert response.status_code == 422


def test_join_room_display_name_control_chars(client, active_room):
    """Test display name with control characters is rejected."""
    response = client.post(
        "/v1/rooms/test-room/join",
        json={"display_name": "user\x01name"},
    )
    assert response.status_code == 422


# ═══════════════════════════════════════════════════════════
# Additional Coverage
# ═══════════════════════════════════════════════════════════


def test_create_room_with_image_url(client, mock_supabase):
    """Test room creation with a custom image URL."""
    response = client.post(
        "/v1/rooms",
        json={
            "display_name": "Host",
            "room_name": "Image Room",
            "room_image_url": "https://example.com/img.png",
        },
    )
    assert response.status_code == 200
    assert response.json()["room_image_url"] == "https://example.com/img.png"


def test_create_room_generates_default_image(client, mock_supabase, monkeypatch):
    """Test room creation auto-generates a DiceBear image when none provided."""
    monkeypatch.setattr("app.routes.rooms.is_rate_limited", lambda action, key: False)
    response = client.post("/v1/rooms", json={"display_name": "Host"})
    assert response.status_code == 200
    assert "dicebear" in response.json()["room_image_url"]


def test_unlock_room_authenticated_host(client, mock_supabase, host_token_hash):
    """Test authenticated user can unlock their own room via user_id."""
    mock_supabase.auth.add_user("jwt-unlock", "user-unlock")
    mock_supabase.table("rooms").data = [
        {
            "id": "r-unlock",
            "slug": "unlock-room",
            "room_name": None,
            "room_image_url": None,
            "host_token_hash": host_token_hash,
            "user_id": "user-unlock",
            "status": "locked",
            "expires_at": None,
        }
    ]
    response = client.post(
        "/v1/rooms/unlock-room/moderation/unlock",
        json={"host_token": "doesnt-matter"},
        headers={"Authorization": "Bearer jwt-unlock"},
    )
    assert response.status_code == 200
    assert "unlocked" in response.json()["message"].lower()


def test_end_room_already_ended(client, mock_supabase, host_token_hash):
    """Test ending an already-ended room still succeeds (idempotent)."""
    mock_supabase.table("rooms").data = [
        {
            "id": "r-ended",
            "slug": "ended-room",
            "room_name": None,
            "room_image_url": None,
            "host_token_hash": host_token_hash,
            "user_id": None,
            "status": "ended",
            "expires_at": None,
        }
    ]
    response = client.post(
        "/v1/rooms/ended-room/moderation/end",
        json={"host_token": "any-token"},
    )
    assert response.status_code == 200
    assert "already ended" in response.json()["message"].lower()


def test_join_room_ended(client, mock_supabase, host_token_hash):
    """Test joining an ended room is rejected."""
    mock_supabase.table("rooms").data = [
        {
            "id": "r-end",
            "slug": "ended",
            "user_id": None,
            "host_token_hash": host_token_hash,
            "status": "ended",
            "expires_at": None,
        }
    ]
    response = client.post(
        "/v1/rooms/ended/join", json={"display_name": "User"}
    )
    assert response.status_code == 423


def test_list_messages_with_since_param(client, active_room, sample_message):
    """Test listing messages with since query parameter."""
    response = client.get(
        "/v1/rooms/test-room/messages?since=2025-01-01T00:00:00%2B00:00"
    )
    assert response.status_code == 200
    # Should still return messages (mock doesn't filter by gte, but endpoint works)
    assert isinstance(response.json(), list)


def test_room_name_too_long(client, mock_supabase):
    """Test room name exceeding 100 chars is rejected."""
    response = client.post(
        "/v1/rooms",
        json={"display_name": "Host", "room_name": "A" * 101},
    )
    assert response.status_code == 422


def test_lock_room_empty_host_token(client, active_room):
    """Test locking room with empty host_token is rejected by Pydantic."""
    response = client.post(
        "/v1/rooms/test-room/moderation/lock",
        json={"host_token": ""},
    )
    assert response.status_code == 422


def test_send_message_to_ended_room(client, active_room):
    """Test sending message to an ended room is rejected."""
    active_room["status"] = "ended"
    response = client.post(
        "/v1/rooms/test-room/messages",
        json={"body": "Hello", "session_id": "session-host"},
    )
    assert response.status_code == 423
