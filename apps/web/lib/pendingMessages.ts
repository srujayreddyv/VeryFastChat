const STORAGE_KEY = "vfc-pending-messages";
export const PENDING_MESSAGES_EVENT = "vfc-pending-messages";

export interface PendingMessage {
  roomSlug: string;
  body: string;
  sessionId: string;
  addedAt: number;
}

function read(): PendingMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PendingMessage =>
        p &&
        typeof p === "object" &&
        typeof (p as PendingMessage).roomSlug === "string" &&
        typeof (p as PendingMessage).body === "string" &&
        typeof (p as PendingMessage).sessionId === "string"
    );
  } catch {
    return [];
  }
}

function write(list: PendingMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(PENDING_MESSAGES_EVENT));
  } catch {
    // ignore
  }
}

export function getPendingMessages(roomSlug?: string): PendingMessage[] {
  const all = read();
  return roomSlug ? all.filter((p) => p.roomSlug === roomSlug) : all;
}

export function addPendingMessage(roomSlug: string, body: string, sessionId: string): void {
  const list = read();
  list.push({ roomSlug, body, sessionId, addedAt: Date.now() });
  write(list);
}

export function removePendingMessage(roomSlug: string, body: string, sessionId: string): void {
  const list = read().filter(
    (p) => !(p.roomSlug === roomSlug && p.body === body && p.sessionId === sessionId)
  );
  write(list);
}

export function clearPendingForRoom(roomSlug: string): void {
  write(read().filter((p) => p.roomSlug !== roomSlug));
}
