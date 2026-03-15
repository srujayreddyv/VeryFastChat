"""Authentication middleware and JWT verification for optional Supabase Auth."""
import logging
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.db import get_supabase, hash_token

logger = logging.getLogger(__name__)


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> str | None:
    """
    Extract and verify JWT token from Authorization header.
    
    Returns:
        user_id (str) if authenticated with valid JWT
        None if no Authorization header (anonymous user)
    
    Raises:
        HTTPException 401 if Authorization header is present but invalid
    
    This dependency makes authentication optional by default.
    For protected endpoints, check if the result is None and raise 401.
    """
    # No Authorization header = anonymous user (valid for backward compatibility)
    if not authorization:
        return None
    
    # Authorization header present but malformed
    if not authorization.startswith("Bearer "):
        logger.warning("Malformed Authorization header (missing 'Bearer ' prefix)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
        )
    
    # Extract token
    token = authorization.split(" ", 1)[1]
    if not token:
        logger.warning("Empty token in Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty authentication token",
        )
    
    # Verify JWT with Supabase
    try:
        sb = get_supabase()
        user_response = sb.auth.get_user(token)
        
        if not user_response or not user_response.user:
            logger.warning("JWT verification failed: no user returned")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
        
        user_id = user_response.user.id
        logger.debug(f"Authenticated user: {user_id}")
        return user_id
        
    except HTTPException:
        # Re-raise our own HTTPExceptions
        raise
    except Exception as e:
        # Log unexpected errors but don't expose details to client
        logger.error(f"JWT verification error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed",
        )


def require_auth(user_id: Annotated[str | None, Depends(get_current_user)]) -> str:
    """
    Dependency that requires authentication.
    
    Use this for protected endpoints that must have a valid JWT.
    
    Returns:
        user_id (str) - guaranteed to be non-None
    
    Raises:
        HTTPException 401 if user is not authenticated
    """
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user_id



def is_room_host(
    room_id: str,
    user_id: str | None = None,
    host_token: str | None = None,
) -> bool:
    """
    Check if user is the host of a room via user_id OR host_token.
    
    This implements dual authorization:
    - Authenticated users: Check if room.user_id matches their user_id
    - Anonymous users OR fallback: Check if host_token matches room.host_token_hash
    
    Args:
        room_id: The room ID to check
        user_id: The authenticated user's ID (from JWT), or None if anonymous
        host_token: The host token provided by the user, or None
    
    Returns:
        True if user is the host (via either method), False otherwise
    """
    sb = get_supabase()
    
    try:
        # Get room data
        response = (
            sb.table("rooms")
            .select("user_id, host_token_hash")
            .eq("id", room_id)
            .maybe_single()
            .execute()
        )
        
        if not response or not response.data:
            return False
        
        room = response.data
        
        # Check user_id match (authenticated host)
        if user_id and room.get("user_id") == user_id:
            logger.debug(f"Host verified via user_id for room {room_id}")
            return True
        
        # Check host_token match (anonymous host or fallback)
        if host_token and room.get("host_token_hash") == hash_token(host_token):
            logger.debug(f"Host verified via host_token for room {room_id}")
            return True
        
        return False
    
    except Exception as e:
        logger.error(f"Error checking room host: {e}")
        return False


def get_room_by_slug(room_slug: str) -> dict | None:
    """
    Get room by slug.
    
    Args:
        room_slug: The room slug
    
    Returns:
        Room dict or None if not found
    """
    sb = get_supabase()
    
    try:
        response = (
            sb.table("rooms")
            .select("id, slug, user_id, host_token_hash, status, expires_at")
            .eq("slug", room_slug)
            .maybe_single()
            .execute()
        )
        
        return response.data if response else None
    except Exception as e:
        logger.error(f"Error fetching room by slug {room_slug}: {e}")
        return None
