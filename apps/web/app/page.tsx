"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { createRoom, type CreateRoomResponse } from "../lib/api";
import { createRoomAuthenticated } from "../lib/api-client";
import { addJoinedRoom } from "../lib/joinedRooms";
import { useRouter } from "next/navigation";
import { useAuth } from "./contexts/AuthContext";
import { Copy } from "lucide-react";

function getShareUrl(roomSlug: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/r/${roomSlug}`;
  }
  return `/r/${roomSlug}`;
}

function CopyButton({ text }: { text: string }) {
  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Link copied to clipboard"),
      () => toast.error("Could not copy")
    );
  };
  return (
    <button type="button" onClick={copy} className="button-secondary button-with-icon" style={{ flexShrink: 0 }}>
      <Copy size={16} aria-hidden />
      Copy link
    </button>
  );
}

function parseRoomSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/r\/([^/]+)/);
    if (match) return match[1];
  } catch {
    // not a URL
  }
  return /^[a-z0-9-]+$/i.test(trimmed) ? trimmed : null;
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [room, setRoom] = useState<CreateRoomResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomImageUrl, setRoomImageUrl] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const onCreateRoom = async () => {
    setLoading(true);
    setError(null);

    try {
      const name = roomName.trim() || undefined;
      const imageUrl = roomImageUrl.trim() || undefined;
      const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Host";
      // Use authenticated API if user is signed in, otherwise use anonymous API
      const result = user 
        ? await createRoomAuthenticated(displayName, name, imageUrl)
        : await createRoom("Host", name, imageUrl);
      
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(`vfc_host_${result.room_slug}`, result.host_token);
      addJoinedRoom(result.room_slug, result.room_name || result.room_slug, result.expires_at, result.room_id);
      }
      setRoom(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to create room";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onJoinWithLink = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const slug = parseRoomSlug(joinInput);
    if (!slug) {
      setJoinError("Enter a room link or slug (e.g. abc-123)");
      return;
    }
    router.push(`/r/${slug}`);
  };

  return (
    <main>
      <div className="landing-hero">
        <h1 className="landing-title">VeryFastChat</h1>
        <p className="landing-subtitle">Create a room and start chatting instantly.</p>
        <p className="landing-tagline">No account required. Sign in to save your rooms.</p>
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Room name (optional)"
          maxLength={100}
          className="landing-room-name-input"
          aria-label="Room name"
        />
        <input
          type="url"
          value={roomImageUrl}
          onChange={(e) => setRoomImageUrl(e.target.value)}
          placeholder="Room image URL (optional)"
          maxLength={500}
          className="landing-room-name-input"
          aria-label="Room image URL"
        />
        <button 
          type="button" 
          onClick={() => void onCreateRoom()} 
          disabled={loading}
          className="landing-cta"
        >
          {loading ? "Creating…" : "Create Room"}
        </button>
        {error && <p className="error form-error">{error}</p>}
      </div>

      {room && (
        <div className="card landing-share-card">
          <h2 className="card-title">Room Created!</h2>
          <div className="share-block">
            <code className="share-url share-url--block">{getShareUrl(room.room_slug)}</code>
            <div className="share-actions">
              <CopyButton text={getShareUrl(room.room_slug)} />
              <button 
                type="button" 
                onClick={() => router.push(`/r/${room.room_slug}`)}
                className="button-with-icon"
              >
                Enter Room
              </button>
            </div>
            <small>Share this link to invite others. Room links are persistent and never expire.</small>
          </div>
        </div>
      )}

      <div className="landing-divider">
        <span>or</span>
      </div>

      <div className="card landing-join-card">
        <h2 className="card-title">Join a room</h2>
        <form onSubmit={onJoinWithLink} className="form-row">
          <input
            type="text"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Paste room link or slug"
            className="join-input"
            aria-label="Room link or slug"
          />
          <button type="submit">Join</button>
        </form>
        {joinError && <p className="error form-error">{joinError}</p>}
      </div>
    </main>
  );
}
