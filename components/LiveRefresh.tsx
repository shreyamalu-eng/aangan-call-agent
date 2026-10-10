"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the page's server data every 20s while the tab is visible, so numbers stay live. */
export function LiveRefresh({ every = 20 }: { every?: number }) {
  const router = useRouter();
  const [at, setAt] = useState<string>("");
  useEffect(() => {
    const stamp = () => setAt(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date()));
    stamp();
    const tick = () => { if (document.visibilityState === "visible" && !document.body.dataset.callLive) { router.refresh(); stamp(); } }; // never during a live call
    const t = setInterval(tick, every * 1000);
    const onShow = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [router, every]);
  return <span className="live" title={`Refreshes every ${every} seconds`}><span className="dot-live" aria-hidden="true" />Live{at ? ` · updated ${at}` : ""}</span>;
}
