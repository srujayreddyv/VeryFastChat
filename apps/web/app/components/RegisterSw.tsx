"use client";

import { useEffect, useState } from "react";

export function RegisterSw() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    setOffline(!navigator.onLine);
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {})
      .catch(() => {});

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      className="offline-banner"
      role="status"
      aria-live="polite"
    >
      You’re offline. Check your connection.
    </div>
  );
}
