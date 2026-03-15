from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4
import random

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.auth import get_current_user
from app.config import settings
from app.db import get_supabase, hash_token
from app.metrics import increment as metrics_increment
from app.rate_limit import is_rate_limited, record_request
from app.session import read_session_cookie, set_session_cookie
from app.schemas import (
    CreateRoomRequest,
    CreateRoomResponse,
    JoinRoomRequest,
    JoinRoomResponse,
    LockRoomRequest,
    MessageResponse,
    RoomDetailsResponse,
    SendMessageRequest,
)

router = APIRouter(tags=["rooms"])

# Word lists for random room name generation
_ADJECTIVES = [
    "Swift", "Bright", "Calm", "Bold", "Warm", "Cool", "Wild", "Quiet",
    "Happy", "Lucky", "Cozy", "Vivid", "Gentle", "Brave", "Witty", "Keen",
    "Mellow", "Lively", "Snappy", "Chill", "Funky", "Groovy", "Cosmic",
    "Stellar", "Radiant", "Mystic", "Golden", "Silver", "Crystal", "Velvet",
]
_NOUNS = [
    "Lounge", "Hub", "Den", "Nest", "Spot", "Zone", "Nook", "Cove",
    "Haven", "Realm", "Studio", "Loft", "Cabin", "Oasis", "Garden", "Plaza",
    "Cafe", "Dojo", "Arena", "Stage", "Deck", "Porch", "Attic", "Vault",
    "Tower", "Bridge", "Harbor", "Summit", "Meadow", "Grove",
]


def _generate_room_name() -> str:
    """Generate a random two-word room name like 'Cosmic Lounge'."""
    return f"{random.choice(_ADJECTIVES)} {random.choice(_NOUNS)}"


def _default_room_image(seed: str) -> str:
    """Generate a deterministic room avatar URL using DiceBear shapes API."""
    return f"https://api.dicebear.com/9.x/shapes/svg?seed={seed}"


def _supabase():
    return get_supabase()


def _client_key(request: Request, suffix: str = "") -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}{suffix}"


@router.post("/rooms", response_model=CreateRoomResponse)
def create_room(
    request: Request,
    payload: CreateRoomRequest,
    user_id: Annotated[str | None, Depends(get_current_user)] = None,
) -> CreateRoomResponse:
    key = _client_key(request)
    if is_rate_limited("create_room", key):
        raise HTTPException(status_code=429, detail="Too many rooms created. Try again later.")
    record_request("create_room", key)

    sb = _supabase()
    room_id = str(uuid4())
    room_slug = str(uuid4())[:8]
    # Rooms are persistent - no expiration
    expires_at = None
    host_token = str(uuid4())
    host_token_hash = hash_token(host_token)
    host_session_id = str(uuid4())

    room_name = payload.room_name or _generate_room_name()
    room_image_url = payload.room_image_url or _default_room_image(room_slug)

    room_row = {
        "id": room_id,
        "slug": room_slug,
        "room_name": room_name,
        "room_image_url": room_image_url,
        "host_token_hash": host_token_hash,
        "status": "active",
        "expires_at": expires_at.isoformat() if expires_at else None,
        "user_id": user_id,  # Set user_id if authenticated, NULL if anonymous
    }
    sb.table("rooms").insert(room_row).execute()

    host_participant_id = str(uuid4())
    sb.table("participants").insert(
        {
            "id": host_participant_id,
            "room_id": room_id,
            "session_id": host_session_id,
            "display_name": payload.display_name,
            "is_host": True,
            "user_id": user_id,  # Set user_id if authenticated, NULL if anonymous
        }
    ).execute()

    share_url = f"{settings.web_app_url.rstrip('/')}/r/{room_slug}"
    metrics_increment("rooms_created")
    return CreateRoomResponse(
        room_id=room_id,
        room_slug=room_slug,
        room_name=room_name,
        room_image_url=room_image_url,
        share_url=share_url,
        host_token=host_token,
        expires_at=expires_at,
    )


@router.get("/rooms/{room_slug}", response_model=RoomDetailsResponse)
def get_room(room_slug: str) -> RoomDetailsResponse:
    sb = _supabase()
    r = (
        sb.table("rooms")
        .select("id, slug, room_name, room_image_url, status, expires_at")
        .eq("slug", room_slug)
        .maybe_single()
        .execute()
    )
    row = r.data if r else None
    if row is None:
        raise HTTPException(status_code=404, detail="Room not found")

    expires_at = None
    if row["expires_at"]:
        expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))

    # Get participant count
    room_id = row["id"]
    participant_r = (
        sb.table("participants")
        .select("id", count="exact")
        .eq("room_id", room_id)
        .execute()
    )
    participant_count = participant_r.count if participant_r.count is not None else 0

    return RoomDetailsResponse(
        room_id=str(row["id"]),
        room_slug=row["slug"],
        room_name=row.get("room_name"),
        room_image_url=row.get("room_image_url"),
        status=row["status"],
        expires_at=expires_at,
        participant_count=participant_count,
    )


@router.post("/rooms/{room_slug}/join", response_model=JoinRoomResponse)
def join_room(
    request: Request,
    response: Response,
    room_slug: str,
    payload: JoinRoomRequest,
    user_id: Annotated[str | None, Depends(get_current_user)] = None,
) -> JoinRoomResponse:
    key = _client_key(request)
    if is_rate_limited("join", key):
        raise HTTPException(status_code=429, detail="Too many join attempts. Try again later.")
    record_request("join", key)

    sb = _supabase()
    r = (
        sb.table("rooms")
        .select("id, user_id, expires_at, status")
        .eq("slug", room_slug)
        .maybe_single()
        .execute()
    )
    room = r.data if r else None
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    # Expiration check removed - rooms are now persistent

    if room["status"] != "active":
        raise HTTPException(status_code=423, detail="Room is not accepting new participants")

    room_id = room["id"]
    
    # Determine if user is host via dual verification
    is_host = False
    
    # Check user_id match (authenticated host)
    if user_id and room.get("user_id") == user_id:
        is_host = True
    # Check host_token match (anonymous host or fallback)
    elif payload.host_token:
        r2 = (
            sb.table("rooms")
            .select("host_token_hash")
            .eq("id", room_id)
            .single()
            .execute()
        )
        if r2.data and r2.data.get("host_token_hash") == hash_token(payload.host_token):
            is_host = True

    # For authenticated users, check if they already joined this room
    if user_id:
        existing = (
            sb.table("participants")
            .select("id, session_id, display_name, is_host")
            .eq("room_id", room_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        existing_data = existing.data if existing else None
        if existing_data:
            # Reuse existing participant — just refresh the session cookie
            session_id = existing_data["session_id"]
            set_session_cookie(response, session_id, room_slug)
            return JoinRoomResponse(
                room_slug=room_slug,
                session_id=session_id,
                participant_id=existing_data["id"],
                display_name=existing_data["display_name"],
                is_host=existing_data.get("is_host", False),
            )

    participant_id = str(uuid4())
    session_id = str(uuid4())

    sb.table("participants").insert(
        {
            "id": participant_id,
            "room_id": room_id,
            "session_id": session_id,
            "display_name": payload.display_name,
            "is_host": is_host,
            "user_id": user_id,  # Set user_id if authenticated, NULL if anonymous
        }
    ).execute()

    set_session_cookie(response, session_id, room_slug)
    metrics_increment("joins")

    return JoinRoomResponse(
        room_slug=room_slug,
        session_id=session_id,
        participant_id=participant_id,
        display_name=payload.display_name,
        is_host=is_host,
    )


def _get_room_id_by_slug(sb, room_slug: str) -> str | None:
    r = sb.table("rooms").select("id").eq("slug", room_slug).maybe_single().execute()
    return r.data["id"] if r and r.data else None


def _get_participant_by_session(sb, room_id: str, session_id: str) -> dict | None:
    r = (
        sb.table("participants")
        .select("id, display_name, is_host")
        .eq("room_id", room_id)
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    return r.data if r else None


@router.get("/rooms/{room_slug}/messages", response_model=list[MessageResponse])
def list_messages(
    room_slug: str,
    since: datetime | None = None,
) -> list[MessageResponse]:
    sb = _supabase()
    room_r = (
        sb.table("rooms")
        .select("id, expires_at")
        .eq("slug", room_slug)
        .maybe_single()
        .execute()
    )
    if not room_r or room_r.data is None:
        raise HTTPException(status_code=404, detail="Room not found")

    # Expiration check removed - rooms are now persistent

    room_id = room_r.data["id"]
    q = (
        sb.table("messages")
        .select("id, participant_id, body, created_at, participants(display_name)")
        .eq("room_id", room_id)
        .is_("deleted_at", "null")
        .order("created_at")
    )
    if since is not None:
        q = q.gte("created_at", since.isoformat())
    r = q.execute()

    out = []
    for row in r.data or []:
        participants = row.get("participants") or {}
        display_name = participants.get("display_name", "Anonymous") if isinstance(participants, dict) else "Anonymous"
        out.append(
            MessageResponse(
                id=str(row["id"]),
                participant_id=str(row["participant_id"]),
                display_name=display_name,
                body=row["body"],
                created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            )
        )
    return out


@router.post("/rooms/{room_slug}/messages", response_model=MessageResponse)
def send_message(request: Request, room_slug: str, payload: SendMessageRequest) -> MessageResponse:
    session_id = read_session_cookie(request.headers.get("cookie"), room_slug)
    if session_id is None:
        session_id = payload.session_id
    if not session_id:
        raise HTTPException(status_code=401, detail="Session required (cookie or session_id)")

    key = _client_key(request, f":{room_slug}:{session_id[:8]}")
    if is_rate_limited("send_message", key):
        raise HTTPException(status_code=429, detail="Too many messages. Slow down.")
    record_request("send_message", key)

    sb = _supabase()
    room_id = _get_room_id_by_slug(sb, room_slug)
    if room_id is None:
        raise HTTPException(status_code=404, detail="Room not found")

    room_r = (
        sb.table("rooms")
        .select("expires_at, status")
        .eq("id", room_id)
        .single()
        .execute()
    )
    room = room_r.data
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    # Expiration check removed - rooms are now persistent
    if room["status"] != "active":
        raise HTTPException(status_code=423, detail="Room is not accepting messages")

    participant = _get_participant_by_session(sb, room_id, session_id)
    if participant is None:
        raise HTTPException(status_code=403, detail="Not a participant in this room")

    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message body cannot be empty")

    msg_id = str(uuid4())
    now = datetime.now(timezone.utc)
    sb.table("messages").insert(
        {
            "id": msg_id,
            "room_id": room_id,
            "participant_id": participant["id"],
            "body": body,
            "created_at": now.isoformat(),
        }
    ).execute()
    metrics_increment("messages_sent")

    return MessageResponse(
        id=msg_id,
        participant_id=str(participant["id"]),
        display_name=participant["display_name"],
        body=body,
        created_at=now,
    )


@router.delete("/rooms/{room_slug}/messages/{message_id}")
def delete_message(request: Request, room_slug: str, message_id: str) -> dict[str, str]:
    session_id = read_session_cookie(request.headers.get("cookie"), room_slug)
    if not session_id:
        raise HTTPException(status_code=401, detail="Session required (cookie or session_id)")

    sb = _supabase()
    room_id = _get_room_id_by_slug(sb, room_slug)
    if room_id is None:
        raise HTTPException(status_code=404, detail="Room not found")

    participant = _get_participant_by_session(sb, room_id, session_id)
    if participant is None:
        raise HTTPException(status_code=403, detail="Not a participant in this room")

    msg_r = (
        sb.table("messages")
        .select("id, participant_id")
        .eq("id", message_id)
        .eq("room_id", room_id)
        .is_("deleted_at", "null")
        .maybe_single()
        .execute()
    )
    if not msg_r or msg_r.data is None:
        raise HTTPException(status_code=404, detail="Message not found or already deleted")

    can_delete = (
        str(msg_r.data["participant_id"]) == str(participant["id"])
        or participant.get("is_host") is True
    )
    if not can_delete:
        raise HTTPException(status_code=403, detail="Cannot delete this message")

    now_iso = datetime.now(timezone.utc).isoformat()
    sb.table("messages").update({"deleted_at": now_iso}).eq("id", message_id).execute()
    return {"status": "ok", "message": "Message deleted"}


@router.post("/rooms/{room_slug}/moderation/lock")
def lock_room(
    room_slug: str,
    payload: LockRoomRequest,
    user_id: Annotated[str | None, Depends(get_current_user)] = None,
) -> dict[str, str]:
    sb = _supabase()
    r = (
        sb.table("rooms")
        .select("id, user_id, host_token_hash, status")
        .eq("slug", room_slug)
        .maybe_single()
        .execute()
    )
    if not r or r.data is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.data["status"] == "locked":
        return {"status": "ok", "message": "Room already locked"}
    
    # Dual host verification
    room_id = r.data["id"]
    is_host = False
    
    # Check user_id match (authenticated host)
    if user_id and r.data.get("user_id") == user_id:
        is_host = True
    # Check host_token match (anonymous host or fallback)
    elif r.data.get("host_token_hash") == hash_token(payload.host_token):
        is_host = True
    
    if not is_host:
        raise HTTPException(status_code=403, detail="Invalid host credentials")

    sb.table("rooms").update({"status": "locked"}).eq("id", room_id).execute()
    return {"status": "ok", "message": "Room locked"}

@router.post("/rooms/{room_slug}/moderation/unlock")
def unlock_room(
    room_slug: str,
    payload: LockRoomRequest,
    user_id: Annotated[str | None, Depends(get_current_user)] = None,
) -> dict[str, str]:
    sb = _supabase()
    r = (
        sb.table("rooms")
        .select("id, user_id, host_token_hash, status")
        .eq("slug", room_slug)
        .maybe_single()
        .execute()
    )
    if not r or r.data is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.data["status"] != "locked":
        return {"status": "ok", "message": "Room is not locked"}

    room_id = r.data["id"]
    is_host = False

    if user_id and r.data.get("user_id") == user_id:
        is_host = True
    elif r.data.get("host_token_hash") == hash_token(payload.host_token):
        is_host = True

    if not is_host:
        raise HTTPException(status_code=403, detail="Invalid host credentials")

    sb.table("rooms").update({"status": "active"}).eq("id", room_id).execute()
    return {"status": "ok", "message": "Room unlocked"}



@router.post("/rooms/{room_slug}/moderation/end")
def end_room(
    room_slug: str,
    payload: LockRoomRequest,
    user_id: Annotated[str | None, Depends(get_current_user)] = None,
) -> dict[str, str]:
    sb = _supabase()
    r = (
        sb.table("rooms")
        .select("id, user_id, host_token_hash, status")
        .eq("slug", room_slug)
        .maybe_single()
        .execute()
    )
    if not r or r.data is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.data["status"] == "ended":
        # Room already ended, try to delete it
        sb.table("rooms").delete().eq("id", r.data["id"]).execute()
        return {"status": "ok", "message": "Room already ended and deleted"}
    
    # Dual host verification
    room_id = r.data["id"]
    is_host = False
    
    # Check user_id match (authenticated host)
    if user_id and r.data.get("user_id") == user_id:
        is_host = True
    # Check host_token match (anonymous host or fallback)
    elif r.data.get("host_token_hash") == hash_token(payload.host_token):
        is_host = True
    
    if not is_host:
        raise HTTPException(status_code=403, detail="Invalid host credentials")
    
    # Get counts for audit logging before deletion
    msg_count_r = sb.table("messages").select("id", count="exact").eq("room_id", room_id).execute()
    participant_count_r = sb.table("participants").select("id", count="exact").eq("room_id", room_id).execute()
    msg_count = msg_count_r.count if msg_count_r.count is not None else 0
    participant_count = participant_count_r.count if participant_count_r.count is not None else 0
    
    # Log deletion for audit
    from app.metrics import increment as metrics_increment
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        "Room ended and deleted: room_id=%s, slug=%s, messages=%d, participants=%d",
        room_id,
        room_slug,
        msg_count,
        participant_count,
    )
    metrics_increment("rooms_deleted")

    # Delete room immediately (cascades to messages and participants)
    sb.table("rooms").delete().eq("id", room_id).execute()
    return {"status": "ok", "message": "Room ended and deleted"}
