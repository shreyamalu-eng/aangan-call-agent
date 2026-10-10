import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Aangan Enquiries", description: "Every enquiry call, its verdict, handoff and cost." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to main content</a>
        <div className="shell">
          <aside className="side">
            <div className="brand">Aangan Studio<small>Enquiry calls</small></div>
            <nav className="nav" aria-label="Main">
              <Link href="/">Overview</Link>
              <Link href="/calls">All calls</Link>
              <Link href="/calls?outcome=qualified">Qualified</Link>
              <Link href="/health">Health</Link>
              <Link href="/settings">Settings</Link>
            </nav>
            <p className="sub hide-sm" style={{ fontSize: 13 }}>{process.env.DASHBOARD_PASSWORD ? (admin ? "Signed in: full details" : "Phone numbers masked") : "Open dashboard: phone numbers masked"}</p>
          </aside>
          <main id="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
