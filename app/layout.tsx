import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Pi Seller Kit",
  description: "Create and sell with Pi in minutes.",
};

// Mobile-first viewport. `viewportFit: cover` lets us use the iPhone safe-area
// insets defined in globals.css.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F5FB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/*
          Pi SDK. Loaded with afterInteractive so a slow or unreachable CDN can
          never block rendering or white-screen the page — the UI is usable
          immediately and the script finishes loading well before a user can tap
          Login with Pi. Login (init + authenticate) runs only on that click and
          is guarded by an 8s timeout in lib/pi.ts, so the button can never stay
          stuck on "Connecting…".
        */}
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="afterInteractive"
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
