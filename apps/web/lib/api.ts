const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const defaultFetchOptions: RequestInit = {
  credentials: "include",
};

export const NETWORK_ERROR_MSG = "Network error. Check your connection and try again.";

function userMessage(res: Response, fallback: string, body?: { detail?: string }): string {
  if (res.status === 429) {
    return "Too many requests. Please try again in a minute.";
  }
  if (res.status === 404) return "Room not found.";
  return body?.detail ?? fallback;
}

async function apiFetch(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error(NETWORK_ERROR_MSG);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await apiFetch(url, options);
    if (res.ok || res.status === 404 || res.status === 429) return res;
    if (res.status >= 500 && attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)));
      lastRes = res;
      continue;
    }
    return res;
  }
  return lastRes!;
}

export type CreateRoomResponse = {
  room_id: string;
  room_slug: string;
  room_name: string | null;
  room_image_url: string | null;
  share_url: string;
  host_token: string;
  expires_at: string | null;
};

export type RoomDetails = {
  room_id: string;
  room_slug: string;
  room_name: string | null;
  room_image_url: string | null;
  status: string;
  expires_at: string | null;
  participant_count: number;
};

export type JoinRoomResponse = {
  room_slug: string;
  session_id: string;
  participant_id: string;
  display_name: string;
  is_host: boolean;
};

export type Message = {
  id: string;
  participant_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

export async function getMessages(
  roomSlug: string,
  since?: string
): Promise<Message[]> {
  const url = new URL(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/messages`
  );
  if (since) url.searchParams.set("since", since);
  const res = await apiFetch(url.toString(), defaultFetchOptions);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `Failed to load messages: ${res.status}`, err));
  }
  return (await res.json()) as Message[];
}

export async function sendMessage(
  roomSlug: string,
  body: string,
  sessionId: string
): Promise<Message> {
  const res = await fetchWithRetry(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/messages`,
    {
      ...defaultFetchOptions,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: body.trim(), session_id: sessionId })
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `Failed to send: ${res.status}`, err));
  }
  return (await res.json()) as Message;
}

export async function deleteMessage(
  roomSlug: string,
  messageId: string
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/messages/${encodeURIComponent(messageId)}`,
    { ...defaultFetchOptions, method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `Delete failed: ${res.status}`, err));
  }
}

export async function createRoom(displayName: string, roomName?: string, roomImageUrl?: string): Promise<CreateRoomResponse> {
  const res = await apiFetch(`${API_BASE_URL}/v1/rooms`, {
    ...defaultFetchOptions,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      display_name: displayName,
      room_name: roomName || null,
      room_image_url: roomImageUrl || null,
      expires_in_minutes: 1440
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `Create room failed: ${res.status}`, err));
  }

  return (await res.json()) as CreateRoomResponse;
}

export async function getRoom(roomSlug: string): Promise<RoomDetails> {
  const res = await fetchWithRetry(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}`,
    defaultFetchOptions
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `Room fetch failed: ${res.status}`, err));
  }

  return (await res.json()) as RoomDetails;
}

export async function joinRoom(
  roomSlug: string,
  displayName: string,
  hostToken?: string | null
): Promise<JoinRoomResponse> {
  const body: { display_name: string; host_token?: string } = { display_name: displayName };
  if (hostToken) body.host_token = hostToken;

  const res = await apiFetch(`${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/join`, {
    ...defaultFetchOptions,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `Join failed: ${res.status}`, err));
  }

  return (await res.json()) as JoinRoomResponse;
}

export async function lockRoom(roomSlug: string, hostToken: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/moderation/lock`,
    {
      ...defaultFetchOptions,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host_token: hostToken })
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `Lock failed: ${res.status}`, err));
  }
}

export async function unlockRoom(roomSlug: string, hostToken: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/moderation/unlock`,
    {
      ...defaultFetchOptions,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host_token: hostToken })
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `Unlock failed: ${res.status}`, err));
  }
}

export async function endRoom(roomSlug: string, hostToken: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/v1/rooms/${encodeURIComponent(roomSlug)}/moderation/end`,
    {
      ...defaultFetchOptions,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host_token: hostToken })
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(userMessage(res, `End room failed: ${res.status}`, err));
  }
}
