"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase handles the token exchange from the URL hash automatically
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      else {
        toast.error("Invalid or expired reset link");
        router.replace("/");
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated!");
      router.replace("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally { setLoading(false); }
  };

  if (!ready) return <p className="page-loading">Verifying reset link...</p>;

  return (
    <div className="settings-page">
      <h1 className="page-title">Set New Password</h1>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-field">
          <label htmlFor="new-password" className="form-label">New Password</label>
          <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            disabled={loading} required minLength={8} autoComplete="new-password" />
          <small>Minimum 8 characters</small>
        </div>

        <div className="form-field">
          <label htmlFor="confirm-password" className="form-label">Confirm Password</label>
          <input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            disabled={loading} required minLength={8} autoComplete="new-password" />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
