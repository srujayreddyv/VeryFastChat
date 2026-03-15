"use client";

import { useEffect, useRef } from "react";
import { sendMessage } from "../../lib/api";
import {
  getPendingMessages,
  removePendingMessage,
  PENDING_MESSAGES_EVENT
} from "../../lib/pendingMessages";

export function PendingMessagesFlush() {
  const flushingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = async () => {
      if (!navigator.onLine || flushingRef.current) return;
      const pending = getPendingMessages();
      if (pending.length === 0) return;
      flushingRef.current = true;
      for (const p of pending) {
        try {
          await sendMessage(p.roomSlug, p.body, p.sessionId);
          removePendingMessage(p.roomSlug, p.body, p.sessionId);
        } catch {
          // leave in queue, will retry next online or next mount
        }
      }
      flushingRef.current = false;
    };

    run();
    const onOnline = () => run();
    const onPendingEvent = () => run();
    window.addEventListener("online", onOnline);
    window.addEventListener(PENDING_MESSAGES_EVENT, onPendingEvent);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(PENDING_MESSAGES_EVENT, onPendingEvent);
    };
  }, []);

  return null;
}
