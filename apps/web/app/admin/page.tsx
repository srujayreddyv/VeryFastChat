"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  getUserRooms,
  lockRoomAuthenticated,
  unlockRoomAuthenticated,
  endRoomAuthenticated,
  type UserRoom,
} from "../../lib/api-client";
import toast from "react-hot-toast";
import { ArrowLeft, Users, Clock, Lock, Unlock, DoorClosed, RefreshCw } from "lucide-react";
import Link from "next/link";

function formatDate(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<UserRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/"); return; }
    if (user) loadRooms();
  }, [user, authLoading, router]);

  const loadRooms = async () => {
    setLoading(true);
    try { setRooms(await getUserRooms()); }
    catch { toast.error("Failed to load rooms"); }
    finally { setLoading(false); }
  };

  const getHostToken = (slug: string) =>
    typeof window !== "undefined" ? window.sessionStorage.getItem(`vfc_host_${slug}`) : null;

  const handleLock = async (room: UserRoom) => {
    const token = getHostToken(room.room_slug);
    if (!token) { toast.error("No host token found. Open the room first."); return; }
    setActionLoading(room.room_id);
    try {
      await lockRoomAuthenticated(room.room_slug, token);
      toast.success("Room locked");
      await loadRooms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to lock");
    } finally { setActionLoading(null); }
  };

  const handleUnlock = async (room: UserRoom) => {
    const token = getHostToken(room.room_slug);
    if (!token) { toast.error("No host token found. Open the room first."); return; }
    setActionLoading(room.room_id);
    try {
      await unlockRoomAuthenticated(room.room_slug, token);
      toast.success("Room unlocked");
      await loadRooms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlock");
    } finally { setActionLoading(null); }
  };

  const handleEnd = async (room: UserRoom) => {
    if (!confirm("End this room? It will be permanently deleted.")) return;
    const token = getHostToken(room.room_slug);
    if (!token) { toast.error("No host token found. Open the room first."); return; }
    setActionLoading(room.room_id);
    try {
      await endRoomAuthenticated(room.room_slug, token);
      toast.success("Room ended");
      await loadRooms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end room");
    } finally { setActionLoading(null); }
  };

  if (authLoading || loading) return <p className="page-loading">Loading...</p>;
  if (!user) return null;

  const activeRooms = rooms.filter(r => r.status === "active");
  const lockedRooms = rooms.filter(r => r.status === "locked");
  const endedRooms = rooms.filter(r => r.status === "ended");

  return (
    <div className="admin-page">
      <button onClick={() => router.back()} className="back-link button-with-icon">
        <ArrowLeft size={16} aria-hidden /> Back
      </button>

      <div className="admin-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Manage all your rooms</p>
        </div>
        <button onClick={loadRooms} disabled={loading} className="button-secondary button-with-icon">
          <RefreshCw size={16} aria-hidden /> Refresh
        </button>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card card">
          <span className="admin-stat-value">{rooms.length}</span>
          <span className="admin-stat-label">Total Rooms</span>
        </div>
        <div className="admin-stat-card card">
          <span className="admin-stat-value">{activeRooms.length}</span>
          <span className="admin-stat-label">Active</span>
        </div>
        <div className="admin-stat-card card">
          <span className="admin-stat-value">{lockedRooms.length}</span>
          <span className="admin-stat-label">Locked</span>
        </div>
        <div className="admin-stat-card card">
          <span className="admin-stat-value">{endedRooms.length}</span>
          <span className="admin-stat-label">Ended</span>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="card empty-state">
          <h2>No rooms yet</h2>
          <p>Create your first room to get started</p>
          <Link href="/" className="button-with-icon" style={{ display: "inline-flex", marginTop: "1rem" }}>
            Create Room
          </Link>
        </div>
      ) : (
        <div className="admin-rooms-table-wrap">
          <table className="admin-rooms-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Status</th>
                <th>Participants</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.room_id}>
                  <td>
                    <Link href={`/r/${room.room_slug}`} className="admin-room-link">
                      {room.room_name || room.room_slug}
                    </Link>
                    {room.room_name && <span className="admin-room-slug muted">{room.room_slug}</span>}
                  </td>
                  <td>
                    <span className={`room-status-badge room-status-badge--${room.status}`}>
                      {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <span className="admin-meta-item"><Users size={14} aria-hidden /> {room.participant_count}</span>
                  </td>
                  <td>
                    <span className="admin-meta-item"><Clock size={14} aria-hidden /> {formatDate(room.created_at)}</span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {room.status === "active" && (
                        <button
                          onClick={() => handleLock(room)}
                          disabled={actionLoading === room.room_id}
                          className="button-secondary button-sm button-with-icon"
                          title="Lock room"
                        >
                          <Lock size={14} aria-hidden /> Lock
                        </button>
                      )}
                      {room.status === "locked" && (
                        <button
                          onClick={() => handleUnlock(room)}
                          disabled={actionLoading === room.room_id}
                          className="button-secondary button-sm button-with-icon"
                          title="Unlock room"
                        >
                          <Unlock size={14} aria-hidden /> Unlock
                        </button>
                      )}
                      {room.status !== "ended" && (
                        <button
                          onClick={() => handleEnd(room)}
                          disabled={actionLoading === room.room_id}
                          className="button-danger button-sm button-with-icon"
                          title="End room"
                        >
                          <DoorClosed size={14} aria-hidden /> End
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
