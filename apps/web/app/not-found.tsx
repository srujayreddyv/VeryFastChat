"use client";

import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="error-page">
      <h1 className="error-page-code">404</h1>
      <p className="error-page-message">Page not found</p>
      <p className="error-page-hint">The page you're looking for doesn't exist or has been moved.</p>
      <Link href="/" className="error-page-link button-with-icon">
        <Home size={16} aria-hidden /> Back to Home
      </Link>
    </div>
  );
}
