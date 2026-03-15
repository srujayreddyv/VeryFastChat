const STORAGE_KEY = "vfc-joined-rooms";
export const JOINED_ROOMS_EVENT = "vfc-room-joined";
export const ROOM_STATUS_EVENT = "vfc-room-status";

export type RoomStatus = "active" | "locked" | "ended";

export interface JoinedRoom {
  slug: string;
  name?: string;
  joinedAt: number;
  status?: RoomStatus;
  expiresAt?: string;
  unreadCount?: number;
  roomId?: string; /* for realtime subscription */
}

function read(): JoinedRoom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is JoinedRoom =>
        r && typeof r === "object" && typeof (r as JoinedRoom).slug === "string"
    );
  } catch {
    return [];
  }
}

function write(rooms: JoinedRoom[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // ignore
  }
}

export function getJoinedRooms(): JoinedRoom[] {
  const rooms = read();
  return rooms.sort((a, b) => b.joinedAt - a.joinedAt);
}

export function addJoinedRoom(slug: string, name?: string, expiresAt?: string | null, roomId?: string): void {
  const rooms = read();
  const existing = rooms.findIndex((r) => r.slug === slug);
  const entry: JoinedRoom = { 
    slug, 
    name, 
    joinedAt: Date.now(), 
    status: "active", 
    expiresAt: expiresAt ?? undefined, 
    unreadCount: 0, 
    roomId 
  };
  if (existing >= 0) {
    rooms[existing] = { ...rooms[existing], ...entry, roomId: roomId ?? rooms[existing].roomId };
  } else {
    rooms.unshift(entry);
  }
  write(rooms);
  window.dispatchEvent(
    new CustomEvent(JOINED_ROOMS_EVENT, { detail: { slug, name } })
  );
}

export function incrementUnread(slug: string): void {
  const rooms = read();
  const i = rooms.findIndex((r) => r.slug === slug);
  if (i < 0) return;
  rooms[i] = { ...rooms[i], unreadCount: (rooms[i].unreadCount ?? 0) + 1 };
  write(rooms);
  window.dispatchEvent(new CustomEvent(ROOM_STATUS_EVENT, { detail: { slug } }));
}

export function updateRoomExpiry(slug: string, expiresAt: string | null): void {
  const rooms = read();
  const i = rooms.findIndex((r) => r.slug === slug);
  if (i < 0) return;
  rooms[i] = { ...rooms[i], expiresAt: expiresAt ?? undefined };
  write(rooms);
  window.dispatchEvent(new CustomEvent(ROOM_STATUS_EVENT, { detail: { slug } }));
}

export function updateRoomId(slug: string, roomId: string): void {
  const rooms = read();
  const i = rooms.findIndex((r) => r.slug === slug);
  if (i < 0) return;
  rooms[i] = { ...rooms[i], roomId };
  write(rooms);
  window.dispatchEvent(new CustomEvent(ROOM_STATUS_EVENT, { detail: { slug } }));
}

export function clearUnread(slug: string): void {
  const rooms = read();
  const i = rooms.findIndex((r) => r.slug === slug);
  if (i < 0) return;
  rooms[i] = { ...rooms[i], unreadCount: 0 };
  write(rooms);
  window.dispatchEvent(new CustomEvent(ROOM_STATUS_EVENT, { detail: { slug } }));
}

export function removeFromJoinedRooms(slug: string): void {
  const rooms = read().filter((r) => r.slug !== slug);
  write(rooms);
  window.dispatchEvent(new CustomEvent(JOINED_ROOMS_EVENT, { detail: {} }));
}

export function updateRoomStatus(slug: string, status: RoomStatus): void {
  const rooms = read();
  const i = rooms.findIndex((r) => r.slug === slug);
  if (i < 0) return;
  rooms[i] = { ...rooms[i], status };
  write(rooms);
  window.dispatchEvent(new CustomEvent(ROOM_STATUS_EVENT, { detail: { slug, status } }));
}
