"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.getSession();
        if (error) { setError(error.message); return; }
        // Redirect to home after successful auth callback
        router.replace("/");
      } catch (e: any) {
        setError(e.message || "Authentication failed");
      }
    };
    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="error-page">
        <h1 className="error-page-code">Auth Error</h1>
        <p className="error-page-message">{error}</p>
        <a href="/" className="error-page-link">Back to Home</a>
      </div>
    );
  }

  return <p className="page-loading">Signing you in...</p>;
}
