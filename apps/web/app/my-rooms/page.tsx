"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getUserRooms, type UserRoom } from "../../lib/api-client";
import toast from "react-hot-toast";
import { ArrowLeft, Home, Users, Clock } from "lucide-react";
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

export default function MyRoomsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<UserRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/"); return; }
    if (user) loadRooms();
  }, [user, authLoading, router]);

  const loadRooms = async () => {
    try { setRooms(await getUserRooms()); }
    catch { toast.error("Failed to load rooms"); }
    finally { setLoading(false); }
  };

  if (authLoading || loading) return <p className="page-loading">Loading...</p>;
  if (!user) return null;

  return (
    <div className="my-rooms-page">
      <button onClick={() => router.back()} className="back-link button-with-icon">
        <ArrowLeft size={16} aria-hidden /> Back
      </button>

      <h1 className="page-title">My Rooms</h1>
      <p className="page-subtitle">Rooms you've created with your account</p>

      {rooms.length === 0 ? (
        <div className="card empty-state">
          <Home size={48} className="empty-state-icon" aria-hidden />
          <h2>No rooms yet</h2>
          <p>Create your first room to get started</p>
          <Link href="/" className="button-with-icon" style={{ display: "inline-flex", marginTop: "1rem" }}>
            Create Room
          </Link>
        </div>
      ) : (
        <div className="rooms-list">
          {rooms.map((room) => (
            <Link key={room.room_id} href={`/r/${room.room_slug}`} className="card room-card">
              <div className="room-card-header">
                {room.room_image_url && (
                  <img src={room.room_image_url} alt="" className="room-card-image" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <h3 className="room-card-title">{room.room_name || `Room ${room.room_slug}`}</h3>
                <span className={`room-status-badge room-status-badge--${room.status}`}>
                  {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                </span>
              </div>
              <div className="room-card-meta">
                <span className="room-card-meta-item"><Users size={14} aria-hidden /> {room.participant_count} {room.participant_count === 1 ? "participant" : "participants"}</span>
                <span className="room-card-meta-item"><Clock size={14} aria-hidden /> Created {formatDate(room.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
