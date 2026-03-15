from datetime import datetime
from pydantic import BaseModel, Field


class CreateRoomRequest(BaseModel):
    display_name: str = Field(default="Host", min_length=1, max_length=32, pattern=r"^[^\x00-\x1f]*$")
    room_name: str | None = Field(default=None, max_length=100, pattern=r"^[^\x00-\x1f]*$")
    room_image_url: str | None = Field(default=None, max_length=500)
    expires_in_minutes: int = Field(default=1440, ge=5, le=10080)


class CreateRoomResponse(BaseModel):
    room_id: str
    room_slug: str
    room_name: str | None
    room_image_url: str | None
    share_url: str
    host_token: str
    expires_at: datetime | None


class RoomDetailsResponse(BaseModel):
    room_id: str
    room_slug: str
    room_name: str | None
    room_image_url: str | None
    status: str
    expires_at: datetime | None
    participant_count: int


class JoinRoomRequest(BaseModel):
    display_name: str = Field(default="Anonymous", min_length=1, max_length=32, pattern=r"^[^\x00-\x1f]*$")
    host_token: str | None = None


class JoinRoomResponse(BaseModel):
    room_slug: str
    session_id: str
    participant_id: str
    display_name: str
    is_host: bool = False


class SendMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000, pattern=r"^[^\x00-\x08\x0b\x0c\x0e-\x1f]*$")
    session_id: str | None = None  # optional when session cookie is sent


class MessageResponse(BaseModel):
    id: str
    participant_id: str
    display_name: str
    body: str
    created_at: datetime


class LockRoomRequest(BaseModel):
    host_token: str = Field(min_length=1)


# Profile schemas
class ProfileResponse(BaseModel):
    id: str
    display_name: str
    avatar_url: str | None
    created_at: datetime
    updated_at: datetime


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=50)
    avatar_url: str | None = Field(None, max_length=500)


class UserRoomResponse(BaseModel):
    room_id: str
    room_slug: str
    room_name: str | None
    room_image_url: str | None
    status: str
    created_at: datetime
    participant_count: int


class UserRoomsListResponse(BaseModel):
    rooms: list[UserRoomResponse]
