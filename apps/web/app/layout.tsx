import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import "./styles.css";
import { ThemeProvider } from "./ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { AppShell } from "./components/AppShell";
import { RegisterSw } from "./components/RegisterSw";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PendingMessagesFlush } from "./components/PendingMessagesFlush";
import { HealthPing } from "./components/HealthPing";

export const metadata: Metadata = {
  title: "VeryFastChat",
  description: "Anonymous chat rooms you can share instantly",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: "/icon-192.png"
  },
  appleWebApp: { 
    capable: true, 
    title: "VeryFastChat",
    statusBarStyle: "default"
  },
  other: {
    "mobile-web-app-capable": "yes"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7c3aed" },
    { media: "(prefers-color-scheme: dark)", color: "#a78bfa" },
  ],
};

const themeScript = `
(function(){
  var s=document.documentElement.getAttribute('data-theme')||localStorage.getItem('vfc-theme')||'system';
  var r=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)?'dark':'light';
  document.documentElement.setAttribute('data-theme',r);
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <AuthProvider>
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <RegisterSw />
            <PendingMessagesFlush />
            <HealthPing />
            <ErrorBoundary>
              <AppShell>{children}</AppShell>
            </ErrorBoundary>
            <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
