"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Home, MessageSquarePlus, Hash, Sun, Moon, Monitor, Link2, X, PanelLeftClose, PanelLeft, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "../contexts/AuthContext";
import { SignInModal } from "./SignInModal";
import { UserProfileDropdown } from "./UserProfileDropdown";
import {
  getJoinedRooms,
  JOINED_ROOMS_EVENT,
  ROOM_STATUS_EVENT,
  removeFromJoinedRooms,
  incrementUnread,
  type JoinedRoom
} from "../../lib/joinedRooms";
import { getSupabase } from "../../lib/supabase";
import { Logo } from "./Logo";

const SIDEBAR_WIDTH = 260;

function getShareUrl(slug: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/r/${slug}`;
}

function formatExpiry(expiresAt?: string): string | null {
  // Rooms are now persistent - no expiration display
  return null;
}

function roomLabel(room: JoinedRoom): string {
  if (room.name && room.name !== room.slug) return room.name;
  return room.slug.length > 10 ? `Room …${room.slug.slice(-8)}` : `Room ${room.slug}`;
}

function CopyRoomLinkButton({ slug }: { slug: string }) {
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = getShareUrl(slug);
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy")
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="app-sidebar-room-action"
      title="Copy room link"
      aria-label={`Copy link for room ${slug}`}
    >
      <Link2 size={14} aria-hidden />
    </button>
  );
}

function useJoinedRooms(): JoinedRoom[] {
  const [rooms, setRooms] = useState<JoinedRoom[]>([]);

  useEffect(() => {
    const load = () => setRooms(getJoinedRooms());
    load();
    const handler = () => load();
    window.addEventListener(JOINED_ROOMS_EVENT, handler);
    window.addEventListener(ROOM_STATUS_EVENT, handler);
    return () => {
      window.removeEventListener(JOINED_ROOMS_EVENT, handler);
      window.removeEventListener(ROOM_STATUS_EVENT, handler);
    };
  }, []);

  return rooms;
}

const SIDEBAR_STORAGE_KEY = "vfc-sidebar-open";

function useSidebarVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setVisible(stored !== "false");
    } catch {
      setVisible(true);
    }
  }, []);
  const toggle = useCallback(() => {
    setVisible((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);
  return [visible, toggle] as const;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const joinedRooms = useJoinedRooms();
  const [sidebarVisible, toggleSidebar] = useSidebarVisible();
  const [roomFilter, setRoomFilter] = useState("");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInModalMode, setSignInModalMode] = useState<"signin" | "signup">("signin");
  const { user } = useAuth();

  const openModal = (mode: "signin" | "signup") => {
    setSignInModalMode(mode);
    setShowSignInModal(true);
  };

  useEffect(() => {
    const roomsWithId = joinedRooms.filter((r): r is JoinedRoom & { roomId: string } => !!r.roomId);
    if (roomsWithId.length === 0) return;
    let mounted = true;
    try {
      const supabase = getSupabase();
      const channels = roomsWithId.map((room) => {
        const ch = supabase
          .channel(`unread:${room.slug}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${room.roomId}` },
            () => {
              if (!mounted) return;
              if (pathname !== `/r/${room.slug}`) incrementUnread(room.slug);
            }
          );
        ch.subscribe();
        return ch;
      });
      return () => {
        mounted = false;
        channels.forEach((ch) => supabase.removeChannel(ch));
      };
    } catch {
      return undefined;
    }
  }, [joinedRooms, pathname]);

  const filteredRooms = roomFilter.trim()
    ? joinedRooms.filter(
        (r) =>
          r.slug.toLowerCase().includes(roomFilter.toLowerCase()) ||
          (r.name && r.name.toLowerCase().includes(roomFilter.toLowerCase()))
      )
    : joinedRooms;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  return (
    <div className={`app-shell ${sidebarVisible ? "" : "app-shell--sidebar-hidden"}`}>
      <aside
        className={`app-sidebar ${sidebarVisible ? "app-sidebar--always-visible" : "app-sidebar--hidden"}`}
        aria-label="Navigation"
        aria-hidden={!sidebarVisible}
      >
        <div className="app-sidebar-panel">
          <nav className="app-sidebar-nav">
            <Link href="/" className="app-sidebar-link">
              <Home size={18} className="app-sidebar-link-icon" aria-hidden />
              <span>Home</span>
            </Link>
            <Link href="/" className="app-sidebar-link">
              <MessageSquarePlus size={18} className="app-sidebar-link-icon" aria-hidden />
              <span>Create room</span>
            </Link>
            <Link href="/#join" className="app-sidebar-link">
              <Link2 size={18} className="app-sidebar-link-icon" aria-hidden />
              <span>Join a room</span>
            </Link>
          </nav>
          <div className="app-sidebar-divider" />
          <div className="app-sidebar-rooms">
            <span className="app-sidebar-rooms-label">
              <Hash size={14} aria-hidden /> Rooms
            </span>
            {joinedRooms.length > 0 ? (
              <>
                {joinedRooms.length > 3 && (
                  <div className="app-sidebar-rooms-filter">
                    <Search size={14} className="app-sidebar-rooms-filter-icon" aria-hidden />
                    <input
                      type="search"
                      value={roomFilter}
                      onChange={(e) => setRoomFilter(e.target.value)}
                      placeholder="Filter rooms"
                      className="app-sidebar-rooms-filter-input"
                      aria-label="Filter rooms"
                    />
                  </div>
                )}
                <ul className="app-sidebar-rooms-list">
                  {filteredRooms.length === 0 ? (
                    <li className="app-sidebar-rooms-empty">No matching rooms</li>
                  ) : (
                    filteredRooms.map((r) => (
                      <li key={r.slug} className="app-sidebar-room-item">
                        <Link href={`/r/${r.slug}`} className="app-sidebar-link app-sidebar-room-link">
                          <span className="app-sidebar-room-name" title={r.name || r.slug}>
                            {roomLabel(r)}
                          </span>
                          {(r.unreadCount ?? 0) > 0 && (
                            <span className="room-unread-badge" aria-label={`${r.unreadCount} unread`}>
                              {r.unreadCount! > 99 ? "99+" : r.unreadCount}
                            </span>
                          )}
                          {r.status && r.status !== "active" && (
                            <span className={`room-status-badge room-status-badge--${r.status}`} title={r.status}>
                              {r.status === "ended" ? "Ended" : "Locked"}
                            </span>
                          )}
                          {formatExpiry(r.expiresAt) && r.status === "active" && (
                            <span className="room-expiry" title={r.expiresAt ? new Date(r.expiresAt).toLocaleString() : undefined}>
                              {formatExpiry(r.expiresAt)}
                            </span>
                          )}
                        </Link>
                        <div className="app-sidebar-room-actions">
                          <CopyRoomLinkButton slug={r.slug} />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              removeFromJoinedRooms(r.slug);
                              toast.success("Removed from list");
                            }}
                            className="app-sidebar-room-action"
                            title="Remove from list"
                            aria-label={`Remove ${r.slug} from list`}
                          >
                            <X size={14} aria-hidden />
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : (
              <p className="app-sidebar-rooms-empty-state">Rooms you join will appear here</p>
            )}
          </div>
        </div>
      </aside>

      <header className="app-header">
        <div className="app-header-left">
          <button
            type="button"
            className="app-header-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            title={sidebarVisible ? "Hide sidebar (Ctrl+B)" : "Show sidebar (Ctrl+B)"}
          >
            {sidebarVisible ? (
              <PanelLeftClose size={20} aria-hidden />
            ) : (
              <PanelLeft size={20} aria-hidden />
            )}
          </button>
          <Link href="/" className="app-header-logo">
            <Logo variant="sm" className="app-logo-icon" aria-hidden />
            <span className="app-header-logo-text">VeryFastChat</span>
          </Link>
        </div>
        <div className="app-header-right">
          {user ? (
            <UserProfileDropdown />
          ) : (
            <>
              <button
                onClick={() => openModal("signin")}
                className="app-header-signin-btn"
              >
                Sign In
              </button>
              <button
                onClick={() => openModal("signup")}
                className="app-header-signup-btn"
              >
                Sign Up
              </button>
            </>
          )}
          <ThemeButton />
        </div>
      </header>

      <div className="app-body">
        <main id="main-content" className="app-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      
      <SignInModal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} initialMode={signInModalMode} />
    </div>
  );
}

const THEME_OPTIONS = ["light", "dark", "system"] as const;
const THEME_LABELS: Record<(typeof THEME_OPTIONS)[number], string> = {
  light: "Light",
  dark: "Dark",
  system: "System"
};

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

function ThemeButton() {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const ThemeIcon = THEME_ICONS[mode];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    firstOptionRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") {
          close();
          return;
        }
        if (e.key === "Tab" && ref.current) {
          const focusable = ref.current.querySelectorAll<HTMLElement>('button[role="menuitem"]');
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
          return;
        }
      }
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("click", handle, true);
    document.addEventListener("keydown", handle, true);
    return () => {
      document.removeEventListener("click", handle, true);
      document.removeEventListener("keydown", handle, true);
    };
  }, [open, close]);

  return (
    <div className="app-header-theme" ref={ref}>
      <button
        type="button"
        className="app-header-theme-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Theme: ${THEME_LABELS[mode]}`}
        title={`Theme: ${THEME_LABELS[mode]}`}
      >
        <ThemeIcon size={18} className="app-header-theme-btn-icon" aria-hidden />
        Theme
      </button>
      {open && (
        <div className="app-header-theme-dropdown" role="menu">
          {THEME_OPTIONS.map((value, idx) => {
            const Icon = THEME_ICONS[value];
            return (
              <button
                key={value}
                ref={idx === 0 ? firstOptionRef : undefined}
                type="button"
                role="menuitem"
                className={`app-header-theme-option ${mode === value ? "app-header-theme-option--active" : ""}`}
                onClick={() => {
                  setMode(value);
                  setOpen(false);
                }}
              >
                <Icon size={18} aria-hidden />
                {THEME_LABELS[value]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
