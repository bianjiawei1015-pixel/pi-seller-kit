import type { Metadata, Viewport } from "next";
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
      {/*
        TO ENABLE THE REAL PI SDK LATER, add this above </head> equivalent:
        import Script from "next/script";
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="beforeInteractive" />
        Then flip MOCK_MODE in lib/pi.ts to false.
      */}
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
