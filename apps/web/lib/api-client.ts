/**
 * Authenticated API client that automatically includes JWT tokens in requests.
 * 
 * This module provides helper functions to make authenticated API calls
 * by automatically injecting the Authorization header with the JWT token
 * from the Supabase session.
 */

import { getSupabase } from "./supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * Get the current JWT token from Supabase session.
 * Returns null if user is not authenticated.
 */
async function getAuthToken(): Promise<string | null> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Make an authenticated API request with automatic JWT injection.
 * Falls back to anonymous request if no token is available.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  
  const headers = new Headers(options.headers);
  
  // Add Authorization header if authenticated
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Always include credentials for session cookies
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };
  
  return fetch(url, fetchOptions);
}

/**
 * Profile API types and functions
 */

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type UpdateProfileRequest = {
  display_name?: string;
  avatar_url?: string | null;
};

export type UserRoom = {
  room_id: string;
  room_slug: string;
  room_name: string | null;
  room_image_url: string | null;
  status: string;
  created_at: string;
  participant_count: number;
};

export type UserRoomsResponse = {
  rooms: UserRoom[];
};

/**
 * Get the current user's profile.
 * Requires authentication.
 */
export async function getProfile(): Promise<Profile> {
  const res = await authenticatedFetch(`${API_BASE_URL}/v1/auth/profile`);
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Failed to fetch profile: ${res.status}`);
  }
  
  return await res.json();
}

/**
 * Create or update the current user's profile.
 * Requires authentication.
 */
export async function updateProfile(data: UpdateProfileRequest): Promise<Profile> {
  const res = await authenticatedFetch(`${API_BASE_URL}/v1/auth/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Failed to update profile: ${res.status}`);
  }
  
  return await res.json();
}

/**
 * Get all rooms owned by the current user.
 * Requires authentication.
 */
export async function getUserRooms(): Promise<UserRoom[]> {
  const res = await authenticatedFetch(`${API_BASE_URL}/v1/auth/rooms`);
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Failed to fetch rooms: ${res.status}`);
  }
  
  const data: UserRoomsResponse = await res.json();
  return data.rooms;
}

/**
 * Enhanced room creation that includes JWT token if authenticated.
 * Falls back to anonymous creation if not authenticated.
 */
export async function createRoomAuthenticated(displayName: string, roomName?: string, roomImageUrl?: string) {
  const res = await authenticatedFetch(`${API_BASE_URL}/v1/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name: displayName,
      room_name: roomName || null,
      room_image_url: roomImageUrl || null,
      expires_in_minutes: 1440,
    }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Create room failed: ${res.status}`);
  }
  
  return await res.json();
}

/**
 * Enhanced room join that includes JWT token if authenticated.
 * Falls back to anonymous join if not authenticated.
 */
export async function joinRoomAuthenticated(
  roomSlug: string,
  displayName: string,
  hostToken?: string | null
) {
  const body: { display_name: string; host_token?: string } = { display_name: displayName };
  if (hostToken) body.host_token = hostToken;
  
  const res = await authenticatedFetch(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Join failed: ${res.status}`);
  }
  
  return await res.json();
}


/**
 * Lock a room (authenticated).
 */
export async function lockRoomAuthenticated(roomSlug: string, hostToken: string): Promise<void> {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/moderation/lock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host_token: hostToken }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Lock failed: ${res.status}`);
  }
}

/**
 * Unlock a room (authenticated).
 */
export async function unlockRoomAuthenticated(roomSlug: string, hostToken: string): Promise<void> {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/moderation/unlock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host_token: hostToken }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Unlock failed: ${res.status}`);
  }
}

/**
 * End a room (authenticated).
 */
export async function endRoomAuthenticated(roomSlug: string, hostToken: string): Promise<void> {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/moderation/end`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host_token: hostToken }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `End room failed: ${res.status}`);
  }
}
