"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="error-page">
      <h1 className="error-page-code">Something went wrong</h1>
      <p className="error-page-message">An unexpected error occurred.</p>
      <p className="error-page-hint">Try refreshing the page or go back home.</p>
      <div className="error-page-actions">
        <button onClick={reset} className="button-secondary button-with-icon">
          <RefreshCw size={16} aria-hidden /> Try Again
        </button>
        <Link href="/" className="error-page-link button-with-icon">
          <Home size={16} aria-hidden /> Back to Home
        </Link>
      </div>
    </div>
  );
}
