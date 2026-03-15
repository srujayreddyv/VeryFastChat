"use client";

import { useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function HealthPing() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch(`${API_BASE}/health`, { method: "GET", keepalive: true })
      .then((res) => {
        if (res.ok && process.env.NODE_ENV === "development") {
          // Optional: log for local dev / debugging
          return res.json().then((d) => ({ ok: true, data: d }));
        }
        return { ok: res.ok };
      })
      .catch(() => {});
  }, []);
  return null;
}
