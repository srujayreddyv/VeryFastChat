"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "signin" | "signup";
}

export function SignInModal({ isOpen, onClose, initialMode = "signin" }: SignInModalProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "forgot") {
      if (!email) { toast.error("Enter your email"); return; }
      setLoading(true);
      try {
        await resetPassword(email);
        toast.success("Password reset link sent to your email");
        setMode("signin");
      } catch (error: any) {
        toast.error(error.message || "Could not send reset link");
      } finally { setLoading(false); }
      return;
    }

    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast.success("Signed in!");
      } else {
        await signUp(email, password, displayName.trim() || undefined);
        toast.success("Account created!");
      }
      onClose();
    } catch (error: any) {
      if (error.message?.includes("Invalid login credentials")) toast.error("Invalid email or password");
      else if (error.message?.includes("User already registered")) toast.error("Email already registered. Try signing in.");
      else toast.error(error.message || "Authentication failed");
    } finally { setLoading(false); }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
    setEmail(""); setPassword(""); setDisplayName(""); setMode("signin");
  };

  const title = mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password";

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="signin-modal-title">
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleClose} disabled={loading} className="modal-close" aria-label="Close">
          <X size={20} aria-hidden />
        </button>

        <h2 id="signin-modal-title" className="modal-title">{title}</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label htmlFor="email" className="form-label">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={loading} required autoComplete="email" />
          </div>

          {mode !== "forgot" && (
            <div className="form-field">
              <div className="form-label-row">
                <label htmlFor="password" className="form-label">Password</label>
                {mode === "signin" && (
                  <button type="button" onClick={() => setMode("forgot")} disabled={loading} className="modal-switch-btn">
                    Forgot password?
                  </button>
                )}
              </div>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={loading} required autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} />
              {mode === "signup" && <small>Minimum 8 characters</small>}
            </div>
          )}

          {mode === "signup" && (
            <div className="form-field">
              <label htmlFor="displayName" className="form-label">Display Name (optional)</label>
              <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading} maxLength={32} placeholder="How others will see you" autoComplete="name" />
            </div>
          )}

          <button type="submit" disabled={loading} className="modal-submit-btn">
            {loading ? "Loading..." : mode === "forgot" ? "Send Reset Link" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="modal-switch">
          {mode === "signin" && (
            <button onClick={() => setMode("signup")} disabled={loading} className="modal-switch-btn">
              Need an account? Sign up
            </button>
          )}
          {mode === "signup" && (
            <button onClick={() => setMode("signin")} disabled={loading} className="modal-switch-btn">
              Already have an account? Sign in
            </button>
          )}
          {mode === "forgot" && (
            <button onClick={() => setMode("signin")} disabled={loading} className="modal-switch-btn">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
