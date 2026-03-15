"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, LogOut, Home, LayoutDashboard } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export function UserProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === "Escape") { setIsOpen(false); return; }
      if (e instanceof MouseEvent && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handle as EventListener);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", handle as EventListener); };
  }, [isOpen]);

  if (!user) return null;

  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
  const avatarUrl = user.user_metadata?.avatar_url;

  // Generate initials: first letter of first name + first letter of last name
  function getInitials(name: string): string {
    const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.charAt(0).toUpperCase();
  }

  const initials = getInitials(displayName);

  const handleSignOut = async () => {
    try { await signOut(); toast.success("Signed out"); setIsOpen(false); router.push("/"); }
    catch { toast.error("Failed to sign out"); }
  };

  const nav = (path: string) => { setIsOpen(false); router.push(path); };

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="profile-trigger" aria-expanded={isOpen} aria-haspopup="true" aria-label={displayName}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="profile-avatar" />
        ) : (
          <span className="profile-avatar-fallback">{initials}</span>
        )}
      </button>

      {isOpen && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-header">
            <span className="profile-menu-name">{displayName}</span>
            <span className="profile-menu-email">{user.email}</span>
          </div>
          <div className="profile-menu-divider" />
          <button onClick={() => nav("/my-rooms")} className="profile-menu-item" role="menuitem">
            <Home size={16} aria-hidden /> My Rooms
          </button>
          <button onClick={() => nav("/admin")} className="profile-menu-item" role="menuitem">
            <LayoutDashboard size={16} aria-hidden /> Admin Dashboard
          </button>
          <button onClick={() => nav("/settings")} className="profile-menu-item" role="menuitem">
            <Settings size={16} aria-hidden /> Settings
          </button>
          <div className="profile-menu-divider" />
          <button onClick={handleSignOut} className="profile-menu-item profile-menu-item--danger" role="menuitem">
            <LogOut size={16} aria-hidden /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
