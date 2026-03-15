"""Profile and authenticated user endpoints."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import require_auth
from app.db import get_supabase
from app.schemas import ProfileResponse, UpdateProfileRequest, UserRoomsListResponse, UserRoomResponse
from app.services.profile import (
    ProfileValidationError,
    get_or_create_profile,
    get_profile,
    update_profile,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["profile"])


@router.get("/auth/profile", response_model=ProfileResponse)
def get_current_profile(
    user_id: Annotated[str, Depends(require_auth)],
) -> ProfileResponse:
    """
    Get the current authenticated user's profile.
    
    Requires: Valid JWT token in Authorization header
    
    Returns:
        Profile with id, display_name, avatar_url, created_at, updated_at
    
    Raises:
        401 if not authenticated
        404 if profile doesn't exist (shouldn't happen if created on sign-in)
    """
    try:
        profile = get_profile(user_id)
        
        if not profile:
            # Profile should exist, but if not, create it
            logger.warning(f"Profile not found for user {user_id}, creating default profile")
            profile = get_or_create_profile(user_id)
        
        return ProfileResponse(**profile)
    except Exception as e:
        logger.error(f"Error fetching/creating profile for user {user_id}: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load profile: {type(e).__name__}",
        )


@router.post("/auth/profile", response_model=ProfileResponse)
def create_or_update_profile(
    payload: UpdateProfileRequest,
    user_id: Annotated[str, Depends(require_auth)],
) -> ProfileResponse:
    """
    Create or update the current user's profile.
    
    Requires: Valid JWT token in Authorization header
    
    Body:
        display_name: Optional new display name (1-50 characters)
        avatar_url: Optional new avatar URL (HTTPS, max 500 characters)
    
    Returns:
        Updated profile
    
    Raises:
        400 if validation fails
        401 if not authenticated
    """
    try:
        # Check if profile exists
        existing = get_profile(user_id)
        
        if not existing:
            # Create new profile
            if not payload.display_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="display_name is required for profile creation",
                )
            
            from app.services.profile import create_profile
            profile = create_profile(
                user_id,
                payload.display_name,
                payload.avatar_url,
            )
        else:
            # Update existing profile
            profile = update_profile(
                user_id,
                display_name=payload.display_name,
                avatar_url=payload.avatar_url,
            )
        
        return ProfileResponse(**profile)
    
    except ProfileValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise  # Re-raise HTTP exceptions (e.g. 400 for missing display_name)
    except Exception as e:
        logger.error(f"Error creating/updating profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )


@router.get("/auth/rooms", response_model=UserRoomsListResponse)
def get_user_rooms(
    user_id: Annotated[str, Depends(require_auth)],
) -> UserRoomsListResponse:
    """
    Get all rooms owned by the authenticated user.
    
    Requires: Valid JWT token in Authorization header
    
    Returns:
        List of rooms with room_id, room_slug, status, created_at, participant_count
        Ordered by created_at descending (newest first)
    
    Raises:
        401 if not authenticated
    """
    sb = get_supabase()
    
    try:
        # Query rooms owned by this user
        rooms_response = (
            sb.table("rooms")
            .select("id, slug, room_name, room_image_url, status, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        
        rooms = []
        for room in rooms_response.data or []:
            # Get participant count for each room
            participant_response = (
                sb.table("participants")
                .select("id", count="exact")
                .eq("room_id", room["id"])
                .execute()
            )
            participant_count = participant_response.count if participant_response.count is not None else 0
            
            rooms.append(
                UserRoomResponse(
                    room_id=room["id"],
                    room_slug=room["slug"],
                    room_name=room.get("room_name"),
                    room_image_url=room.get("room_image_url"),
                    status=room["status"],
                    created_at=room["created_at"],
                    participant_count=participant_count,
                )
            )
        
        return UserRoomsListResponse(rooms=rooms)
    
    except Exception as e:
        logger.error(f"Error fetching user rooms: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch rooms",
        )
