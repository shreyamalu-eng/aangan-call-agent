import "./globals.css";
import type { Metadata, Viewport } from "next";
import { attention } from "@/lib/queries";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Aangan Enquiries", description: "Every enquiry call, its verdict, handoff and cost." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic"; // the bell count is live on every page

// Runs before paint so a saved theme or collapsed sidebar never flashes. Default theme follows the system.
const BOOT = `try{var d=document.documentElement,t=localStorage.getItem("theme");if(t==="light"||t==="dark")d.dataset.theme=t;if(localStorage.getItem("sidebar")==="collapsed")d.dataset.sidebar="collapsed"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let count: number | null = null;
  try { count = (await attention()).length; } catch { /* db down: no badge */ }
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to main content</a>
        <Shell attention={count}>{children}</Shell>
      </body>
    </html>
  );
}
