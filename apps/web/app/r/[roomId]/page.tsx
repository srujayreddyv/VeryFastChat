"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  getRoom,
  getMessages,
  joinRoom,
  lockRoom,
  unlockRoom,
  endRoom,
  sendMessage,
  deleteMessage,
  NETWORK_ERROR_MSG,
  type JoinRoomResponse,
  type Message,
  type RoomDetails
} from "../../../lib/api";
import { joinRoomAuthenticated } from "../../../lib/api-client";
import { useAuth } from "../../contexts/AuthContext";
import { getSupabase } from "../../../lib/supabase";
import { addJoinedRoom, updateRoomStatus, updateRoomExpiry, updateRoomId, clearUnread } from "../../../lib/joinedRooms";
import {
  getPendingMessages,
  addPendingMessage,
  PENDING_MESSAGES_EVENT
} from "../../../lib/pendingMessages";
import { Link2, Lock, Unlock, DoorClosed, Trash2, Send, ChevronDown } from "lucide-react";

interface RoomPageProps {
  params: {
    roomId: string;
  };
}

type RoomState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "join"; room: RoomDetails }
  | { status: "joined"; room: RoomDetails; me: JoinRoomResponse };

export default function RoomPage({ params }: RoomPageProps) {
  const slug = params.roomId;
  const { user } = useAuth();
  const [state, setState] = useState<RoomState>({ status: "loading" });

  const loadRoom = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const room = await getRoom(slug);
      updateRoomStatus(room.room_slug, room.status as "active" | "locked" | "ended");
      updateRoomExpiry(room.room_slug, room.expires_at);
      updateRoomId(room.room_slug, room.room_id);
      setState({ status: "join", room });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Could not load room"
      });
    }
  }, [slug]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  const handleJoin = async (displayName: string, hostToken?: string | null) => {
    if (state.status !== "join") return;
    try {
      // Use authenticated API if user is signed in, otherwise use anonymous API
      const me = user
        ? await joinRoomAuthenticated(slug, displayName || "Anonymous", hostToken)
        : await joinRoom(slug, displayName || "Anonymous", hostToken);
      
      const room = state.room;
      updateRoomStatus(room.room_slug, room.status as "active" | "locked" | "ended");
      addJoinedRoom(room.room_slug, room.room_name || room.room_slug, room.expires_at, room.room_id);
      setState({ status: "joined", room, me });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not join room";
      setState({ status: "error", message: msg });
      toast.error(msg);
    }
  };

  const handleLocked = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "joined") return prev;
      const room = { ...prev.room, status: "locked" };
      updateRoomStatus(room.room_slug, "locked");
      return { ...prev, room };
    });
  }, []);

  const handleEnded = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "joined") return prev;
      const room = { ...prev.room, status: "ended" };
      updateRoomStatus(room.room_slug, "ended");
      return { ...prev, room };
    });
  }, []);

  const handleUnlocked = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "joined") return prev;
      const room = { ...prev.room, status: "active" };
      updateRoomStatus(room.room_slug, "active");
      return { ...prev, room };
    });
  }, []);

  // Clear unread count when joined
  useEffect(() => {
    if (state.status === "joined") {
      clearUnread(state.room.room_slug);
    }
  }, [state]);

  if (state.status === "loading") {
    return (
      <main>
        <div className="card">
          <RoomSkeleton />
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main>
        <div className="card">
          <p className="error form-error">{state.message}</p>
          <button type="button" onClick={loadRoom} className="button-with-icon">
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (state.status === "join") {
    if (state.room.status === "ended") {
      return (
        <main>
          <div className="card">
            <p className="muted">This room has ended.</p>
          </div>
        </main>
      );
    }

    if (state.room.status === "locked") {
      return (
        <main>
          <div className="card">
            <p className="muted">This room is currently locked. No new participants can join.</p>
          </div>
        </main>
      );
    }

    // Auto-join for authenticated users
    if (user) {
      return <AutoJoin room={state.room} onJoin={handleJoin} user={user} />;
    }

    return (
      <JoinForm
        roomSlug={state.room.room_slug}
        roomName={state.room.room_name}
        expiresAt={state.room.expires_at}
        participantCount={state.room.participant_count}
        onJoin={handleJoin}
      />
    );
  }

  const hostToken =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(`vfc_host_${state.room.room_slug}`)
      : null;

  const showModeration =
    state.me.is_host && hostToken && (state.room.status === "active" || state.room.status === "locked");

  return (
    <main className="room-page">
      <div className="card room-info-card">
        <div className="room-header">
          {state.room.room_image_url && (
            <img
              src={state.room.room_image_url}
              alt={state.room.room_name || "Room"}
              className="room-header-image"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <h1 className="room-header-title">{state.room.room_name || state.room.room_slug}</h1>
          <p className="room-header-meta muted">
            <strong>{state.me.display_name}</strong>
            {state.me.is_host && " · host"}
          </p>
          {showModeration && (
            <div className="room-header-actions">
              {state.room.status === "active" && (
                <LockButton roomSlug={state.room.room_slug} hostToken={hostToken} onLocked={handleLocked} />
              )}
              {state.room.status === "locked" && (
                <UnlockButton roomSlug={state.room.room_slug} hostToken={hostToken} onUnlocked={handleUnlocked} />
              )}
              <EndRoomButton
                roomSlug={state.room.room_slug}
                hostToken={hostToken!}
                onEnded={handleEnded}
              />
            </div>
          )}
        </div>
      </div>
      <Chat
        roomId={state.room.room_id}
        roomSlug={state.room.room_slug}
        roomStatus={state.room.status}
        sessionId={state.me.session_id}
        participantId={state.me.participant_id}
        displayName={state.me.display_name}
        isHost={state.me.is_host}
      />
    </main>
  );
}

function RoomSkeleton() {
  return (
    <div className="skeleton-group">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" style={{ width: "70%" }} />
      <div className="skeleton skeleton-line" style={{ width: "50%", marginTop: "0.75rem" }} />
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="skeleton-messages">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton-message">
          <div className="skeleton skeleton-line" style={{ width: "4rem", height: "0.85rem" }} />
          <div className="skeleton skeleton-line" style={{ width: i % 2 ? "80%" : "60%", height: "1rem" }} />
        </div>
      ))}
    </div>
  );
}

function CopyLinkButton({ roomSlug }: { roomSlug: string }) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${roomSlug}`
      : "";
  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy")
    );
  };
  return (
    <button type="button" onClick={copy} className="button-secondary button-sm button-with-icon">
      <Link2 size={16} aria-hidden />
      Copy link
    </button>
  );
}

function LockButton({
  roomSlug,
  hostToken,
  onLocked
}: {
  roomSlug: string;
  hostToken: string;
  onLocked: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLock = async () => {
    setLoading(true);
    setError(null);
    try {
      await lockRoom(roomSlug, hostToken);
      onLocked();
      toast.success("Room locked");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to lock";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={handleLock} disabled={loading} className="button-secondary button-with-icon">
        <Lock size={16} aria-hidden />
        {loading ? "Locking…" : "Lock room"}
      </button>
      {error && <span className="error">{error}</span>}
    </>
  );
}

function UnlockButton({
  roomSlug,
  hostToken,
  onUnlocked
}: {
  roomSlug: string;
  hostToken: string;
  onUnlocked: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);
    try {
      await unlockRoom(roomSlug, hostToken);
      onUnlocked();
      toast.success("Room unlocked");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to unlock";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={handleUnlock} disabled={loading} className="button-secondary button-with-icon">
        <Unlock size={16} aria-hidden />
        {loading ? "Unlocking…" : "Unlock room"}
      </button>
      {error && <span className="error">{error}</span>}
    </>
  );
}

function EndRoomButton({
  roomSlug,
  hostToken,
  onEnded
}: {
  roomSlug: string;
  hostToken: string;
  onEnded: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnd = async () => {
    if (!confirm("End this room? No one will be able to join or send messages.")) return;
    setLoading(true);
    setError(null);
    try {
      await endRoom(roomSlug, hostToken);
      onEnded();
      toast.success("Room ended");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to end room";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={handleEnd} disabled={loading} className="button-danger button-with-icon">
        <DoorClosed size={16} aria-hidden />
        {loading ? "Ending…" : "End room"}
      </button>
      {error && <span className="error">{error}</span>}
    </>
  );
}

function Chat({
  roomId,
  roomSlug,
  roomStatus,
  sessionId,
  participantId,
  displayName,
  isHost
}: {
  roomId: string;
  roomSlug: string;
  roomStatus: string;
  sessionId: string;
  participantId: string;
  displayName: string;
  isHost: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const wasAtBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [connectionState, setConnectionState] = useState<"connected" | "disconnected" | "reconnecting">("connected");
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageTimestampRef = useRef<string | null>(null);
  
  useEffect(() => {
    setPendingCount(getPendingMessages(roomSlug).length);
    const handler = () => setPendingCount(getPendingMessages(roomSlug).length);
    window.addEventListener(PENDING_MESSAGES_EVENT, handler);
    return () => window.removeEventListener(PENDING_MESSAGES_EVENT, handler);
  }, [roomSlug]);

  const [messagesLoading, setMessagesLoading] = useState(true);
  const fetchMessages = useCallback(async (since?: string) => {
    try {
      const list = await getMessages(roomSlug, since);
      if (since) {
        // Merge new messages with existing ones, avoiding duplicates
        setMessages((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = list.filter(m => !existingIds.has(m.id));
          if (newMessages.length > 0) {
            return [...prev, ...newMessages];
          }
          return prev;
        });
      } else {
        setMessages(list);
      }
      
      // Update last message timestamp
      if (list.length > 0) {
        const latestMessage = list[list.length - 1];
        lastMessageTimestampRef.current = latestMessage.created_at;
      }
      
      setError(null);
    } catch {
      setError("Could not load messages");
      toast.error("Could not load messages");
    } finally {
      setMessagesLoading(false);
    }
  }, [roomSlug]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    let mounted = true;
    let pollFallback: ReturnType<typeof setInterval> | null = null;
    let currentChannel: any = null;

    const setupChannel = () => {
      try {
        const supabase = getSupabase();
        const channel = supabase
          .channel(`room:${roomId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `room_id=eq.${roomId}`
            },
            () => {
              if (mounted) {
                // Fetch new messages since last known timestamp
                if (lastMessageTimestampRef.current) {
                  fetchMessages(lastMessageTimestampRef.current);
                } else {
                  fetchMessages();
                }
              }
            }
          )
          .on("presence", { event: "sync" }, () => {
            if (!mounted) return;
            const state = channel.presenceState();
            let count = 0;
            const typers: string[] = [];
            for (const list of Object.values(state) as any[]) {
              if (!Array.isArray(list)) continue;
              for (const p of list) {
                count++;
                if (p.is_typing && p.display_name !== displayName) {
                  typers.push(p.display_name);
                }
              }
            }
            setOnlineCount(count);
            setTypingUsers(typers);
          })
          .subscribe((status) => {
            if (!mounted) return;
            
            if (status === "SUBSCRIBED") {
              setConnectionState("connected");
              reconnectAttemptsRef.current = 0;
              
              // Fetch any messages missed during disconnection
              if (lastMessageTimestampRef.current) {
                fetchMessages(lastMessageTimestampRef.current);
              }
              
              channel.track({ display_name: displayName, participant_id: participantId, is_typing: false });
              channelRef.current = channel;
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setConnectionState("disconnected");
              attemptReconnect();
            } else if (status === "CLOSED") {
              setConnectionState("disconnected");
              attemptReconnect();
            }
          });
        
        currentChannel = channel;
      } catch {
        setConnectionState("disconnected");
        pollFallback = setInterval(() => {
          if (mounted) fetchMessages();
        }, 2500);
      }
    };

    const attemptReconnect = () => {
      if (!mounted) return;
      
      setConnectionState("reconnecting");
      reconnectAttemptsRef.current += 1;
      
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!mounted) return;
        
        // Clean up old channel
        if (currentChannel) {
          try {
            const supabase = getSupabase();
            supabase.removeChannel(currentChannel);
          } catch {
            // ignore
          }
        }
        
        // Setup new channel
        setupChannel();
      }, delay);
    };

    setupChannel();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (currentChannel) {
        try {
          const supabase = getSupabase();
          supabase.removeChannel(currentChannel);
        } catch {
          // ignore
        }
      }
      if (pollFallback) {
        clearInterval(pollFallback);
      }
    };
  }, [roomId, displayName, participantId, fetchMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
      wasAtBottomRef.current = atBottom;
      setShowScrollToBottom(!atBottom);
    }
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;
    const prev = prevMessageCountRef.current;
    if (messages.length > prev && wasAtBottomRef.current) {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowScrollToBottom(false);
    }
    if (messages.length > prev && prev > 0 && typeof document !== "undefined" && document.hidden) {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("VeryFastChat", {
            body: "New message in room",
            tag: `room-${roomId}`,
            requireInteraction: false
          });
        } catch {
          // ignore
        }
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, roomId]);

  const handleDelete = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;
    try {
      await deleteMessage(roomSlug, messageId);
      fetchMessages();
      toast.success("Message deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleTyping = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.track({ display_name: displayName, participant_id: participantId, is_typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      ch.track({ display_name: displayName, participant_id: participantId, is_typing: false });
    }, 2000);
  }, [displayName, participantId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || roomStatus !== "active") return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(roomSlug, text, sessionId);
      setInput("");
      // Clear typing indicator on send
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      channelRef.current?.track({ display_name: displayName, participant_id: participantId, is_typing: false });
      fetchMessages();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      if (msg === NETWORK_ERROR_MSG) {
        addPendingMessage(roomSlug, text, sessionId);
        setInput("");
        toast.success("Message saved. Will send when back online.");
      } else {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const canSend = roomStatus === "active";
  const placeholder =
    roomStatus === "ended"
      ? "Room ended"
      : roomStatus === "locked"
        ? "Room locked"
        : "Type a message…";

  return (
    <div className="card chat-card">
      {connectionState !== "connected" && (
        <div className={`connection-status connection-status--${connectionState}`}>
          {connectionState === "reconnecting" ? "Reconnecting..." : "Disconnected"}
        </div>
      )}
      {onlineCount > 0 && (
        <p className="chat-presence muted">{onlineCount} online</p>
      )}
      {typingUsers.length > 0 && (
        <p className="chat-typing muted">
          {typingUsers.length === 1
            ? `${typingUsers[0]} is typing…`
            : typingUsers.length === 2
              ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
              : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing…`}
        </p>
      )}
      {roomStatus === "locked" && (
        <p className="chat-locked muted">This room is locked. No new messages.</p>
      )}
      {roomStatus === "ended" && (
        <p className="chat-locked muted">This room has ended.</p>
      )}
      <div className="chat-messages-wrap">
        <div
          ref={messagesContainerRef}
          className="chat-messages"
          role="log"
          aria-live="polite"
          onScroll={() => {
          const el = messagesContainerRef.current;
          if (el) {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            wasAtBottomRef.current = atBottom;
            setShowScrollToBottom(!atBottom);
          }
        }}
      >
        {messagesLoading && messages.length === 0 ? (
          <MessagesSkeleton />
        ) : (
          <>
            {messages.length === 0 && !error && (
              <p className="chat-empty">No messages yet. Say hello!</p>
            )}
            {error && <p className="error">{error}</p>}
            {messages.map((m) => {
          const isOwn = m.participant_id === participantId;
          const canDelete = isOwn || isHost;
          return (
            <div
              key={m.id}
              className={`chat-message ${isOwn ? "chat-message--own" : ""}`}
            >
              <span className="chat-message-author">{m.display_name}</span>
              <span className="chat-message-body">{m.body}</span>
              <span className="chat-message-time">
                {new Date(m.created_at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
              {canDelete && (
                <button
                  type="button"
                  className="chat-message-delete button-with-icon"
                  onClick={() => handleDelete(m.id)}
                  title="Delete message"
                >
                  <Trash2 size={14} aria-hidden />
                  Delete
                </button>
              )}
            </div>
          );
        })}
            <div ref={listEndRef} />
          </>
        )}
        </div>
        {showScrollToBottom && (
          <button
            type="button"
            className="chat-scroll-to-bottom"
            onClick={() => {
              listEndRef.current?.scrollIntoView({ behavior: "smooth" });
              setShowScrollToBottom(false);
              wasAtBottomRef.current = true;
            }}
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={20} aria-hidden />
            <span>Scroll to bottom</span>
          </button>
        )}
      </div>
      <form onSubmit={handleSend} className="chat-form">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); handleTyping(); }}
          placeholder={placeholder}
          maxLength={2000}
          disabled={sending || !canSend}
          className="chat-input"
        />
        <button type="submit" disabled={sending || !input.trim() || !canSend} className="button-with-icon">
          <Send size={16} aria-hidden />
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {pendingCount > 0 && (
        <p className="chat-pending muted" role="status">
          {pendingCount} message{pendingCount !== 1 ? "s" : ""} will send when back online.
        </p>
      )}
      <div className="chat-share">
        <code className="share-url">/r/{roomSlug}</code>
        <CopyLinkButton roomSlug={roomSlug} />
      </div>
    </div>
  );
}

function JoinForm({
  roomSlug,
  roomName,
  expiresAt,
  participantCount,
  onJoin
}: {
  roomSlug: string;
  roomName: string | null;
  expiresAt: string | null;
  participantCount: number;
  onJoin: (displayName: string, hostToken?: string | null) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const hostToken =
      typeof window !== "undefined" ? window.sessionStorage.getItem(`vfc_host_${roomSlug}`) : null;
    onJoin(displayName, hostToken);
    setLoading(false);
  };

  return (
    <main>
      <div className="card">
        <h2 className="card-title">Join room</h2>
        <p className="muted join-meta">
          {roomName ? <><strong>{roomName}</strong> <code>{roomSlug}</code></> : <code>{roomSlug}</code>}
          {participantCount > 0 && (
            <span> • {participantCount} {participantCount === 1 ? "person" : "people"} in this room</span>
          )}
        </p>
        <form onSubmit={submit} className="row form-row">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name (optional)"
            maxLength={32}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Joining…" : "Join room"}
          </button>
        </form>
      </div>
    </main>
  );
}


function AutoJoin({
  room,
  onJoin,
  user
}: {
  room: RoomDetails;
  onJoin: (displayName: string, hostToken?: string | null) => void;
  user: { user_metadata?: { display_name?: string }; email?: string };
}) {
  const joinedRef = useRef(false);

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
    const hostToken = typeof window !== "undefined" ? window.sessionStorage.getItem(`vfc_host_${room.room_slug}`) : null;
    onJoin(displayName, hostToken);
  }, [room, onJoin, user]);

  return (
    <main>
      <div className="card">
        <p className="muted">Joining room...</p>
      </div>
    </main>
  );
}
