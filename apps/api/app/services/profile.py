"""Profile service for user profile management."""
import logging
import re
from datetime import datetime, timezone

from app.db import get_supabase

logger = logging.getLogger(__name__)


class ProfileValidationError(ValueError):
    """Raised when profile data fails validation."""
    pass


def validate_display_name(display_name: str) -> None:
    """
    Validate display name meets requirements.
    
    Rules:
    - Must be between 1 and 50 characters
    - Cannot be empty or only whitespace
    
    Raises:
        ProfileValidationError if validation fails
    """
    if not display_name or not display_name.strip():
        raise ProfileValidationError("Display name cannot be empty")
    
    if len(display_name) < 1 or len(display_name) > 50:
        raise ProfileValidationError("Display name must be between 1 and 50 characters")


def validate_avatar_url(avatar_url: str | None) -> None:
    """
    Validate avatar URL meets requirements.
    
    Rules:
    - Must be HTTPS (if provided)
    - Must be 500 characters or less
    - Can be None/empty
    
    Raises:
        ProfileValidationError if validation fails
    """
    if not avatar_url:
        return  # None or empty is valid
    
    if len(avatar_url) > 500:
        raise ProfileValidationError("Avatar URL must be 500 characters or less")
    
    if not avatar_url.startswith("https://"):
        raise ProfileValidationError("Avatar URL must be HTTPS")


def get_profile(user_id: str) -> dict | None:
    """
    Get user profile by user_id.
    
    Args:
        user_id: The authenticated user's ID
    
    Returns:
        Profile dict with keys: id, display_name, avatar_url, created_at, updated_at
        None if profile doesn't exist
    """
    sb = get_supabase()
    
    try:
        response = (
            sb.table("profiles")
            .select("id, display_name, avatar_url, created_at, updated_at")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        
        if response is None:
            return None
        return response.data
    except Exception as e:
        logger.error(f"Error fetching profile for user {user_id}: {e}")
        raise


def create_profile(user_id: str, display_name: str, avatar_url: str | None = None) -> dict:
    """
    Create a new user profile.
    
    Args:
        user_id: The authenticated user's ID
        display_name: Display name (1-50 characters)
        avatar_url: Optional HTTPS avatar URL (max 500 characters)
    
    Returns:
        Created profile dict
    
    Raises:
        ProfileValidationError if validation fails
    """
    validate_display_name(display_name)
    validate_avatar_url(avatar_url)
    
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    
    profile_data = {
        "id": user_id,
        "display_name": display_name,
        "avatar_url": avatar_url,
        "created_at": now,
        "updated_at": now,
    }
    
    try:
        response = sb.table("profiles").insert(profile_data).execute()
        
        if not response.data:
            raise RuntimeError("Profile creation failed: no data returned")
        
        logger.info(f"Created profile for user {user_id}")
        return response.data[0]
    except Exception as e:
        logger.error(f"Error creating profile for user {user_id}: {e}")
        raise


def update_profile(
    user_id: str,
    display_name: str | None = None,
    avatar_url: str | None = None,
) -> dict:
    """
    Update user profile.
    
    Args:
        user_id: The authenticated user's ID
        display_name: New display name (optional)
        avatar_url: New avatar URL (optional, can be None to clear)
    
    Returns:
        Updated profile dict
    
    Raises:
        ProfileValidationError if validation fails
    """
    # Build update dict with only provided fields
    update_data = {}
    
    if display_name is not None:
        validate_display_name(display_name)
        update_data["display_name"] = display_name
    
    if avatar_url is not None:
        validate_avatar_url(avatar_url)
        update_data["avatar_url"] = avatar_url
    
    if not update_data:
        # Nothing to update, just return current profile
        profile = get_profile(user_id)
        if not profile:
            raise RuntimeError(f"Profile not found for user {user_id}")
        return profile
    
    # updated_at is handled by database trigger
    sb = get_supabase()
    
    try:
        response = (
            sb.table("profiles")
            .update(update_data)
            .eq("id", user_id)
            .execute()
        )
        
        if not response.data:
            raise RuntimeError(f"Profile update failed: no data returned for user {user_id}")
        
        logger.info(f"Updated profile for user {user_id}")
        return response.data[0]
    except Exception as e:
        logger.error(f"Error updating profile for user {user_id}: {e}")
        raise


def get_or_create_profile(user_id: str, email: str | None = None) -> dict:
    """
    Get existing profile or create one with default values.
    
    This is called automatically on first sign-in.
    
    Args:
        user_id: The authenticated user's ID
        email: User's email (used to generate default display name)
    
    Returns:
        Profile dict
    """
    # Try to get existing profile
    profile = get_profile(user_id)
    if profile:
        return profile
    
    # Create new profile with default display name
    default_name = "User"
    if email:
        # Use email prefix as default display name
        default_name = email.split("@")[0]
        # Truncate to 50 characters if needed
        if len(default_name) > 50:
            default_name = default_name[:50]
    
    return create_profile(user_id, default_name, avatar_url=None)
