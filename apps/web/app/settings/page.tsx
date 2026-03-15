"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getProfile, updateProfile, type Profile } from "../../lib/api-client";
import toast from "react-hot-toast";
import { ArrowLeft, Save } from "lucide-react";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/"); return; }
    if (user) loadProfile();
  }, [user, authLoading, router]);

  const loadProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
      setDisplayName(data.display_name);
      setAvatarUrl(data.avatar_url || "");
    } catch (error: any) {
      const msg = error?.message || "Failed to load profile";
      console.error("Profile load error:", msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error("Display name cannot be empty"); return; }
    if (displayName.length > 50) { toast.error("Display name must be 50 characters or less"); return; }
    if (avatarUrl && !avatarUrl.startsWith("https://")) { toast.error("Avatar URL must be HTTPS"); return; }

    setSaving(true);
    try {
      const updated = await updateProfile({ display_name: displayName.trim(), avatar_url: avatarUrl.trim() || null });
      setProfile(updated);
      toast.success("Profile updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally { setSaving(false); }
  };

  if (authLoading || loading) return <p className="page-loading">Loading...</p>;
  if (!user) return null;

  return (
    <div className="settings-page">
      <button onClick={() => router.back()} className="back-link button-with-icon">
        <ArrowLeft size={16} aria-hidden /> Back
      </button>

      <h1 className="page-title">Profile Settings</h1>

      <form onSubmit={handleSave} className="settings-form">
        <div className="form-field">
          <label htmlFor="email" className="form-label">Email</label>
          <input id="email" type="email" value={user.email || ""} disabled className="input-disabled" />
          <small>Email cannot be changed</small>
        </div>

        <div className="form-field">
          <label htmlFor="displayName" className="form-label">Display Name</label>
          <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving} required minLength={1} maxLength={50} />
          <small>1–50 characters</small>
        </div>

        <div className="form-field">
          <label htmlFor="avatarUrl" className="form-label">Avatar URL (optional)</label>
          <input id="avatarUrl" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
            disabled={saving} placeholder="https://example.com/avatar.jpg" maxLength={500} />
          <small>Must be HTTPS, max 500 characters</small>
        </div>

        {avatarUrl && (
          <div className="form-field">
            <span className="form-label">Preview</span>
            <img src={avatarUrl} alt="Avatar preview" className="profile-avatar-preview"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; toast.error("Invalid avatar URL"); }} />
          </div>
        )}

        <button type="submit" disabled={saving} className="button-with-icon">
          <Save size={16} aria-hidden /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
