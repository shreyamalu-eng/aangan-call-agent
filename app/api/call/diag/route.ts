import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";

/** Browser-call troubleshooting log (join/leave/end events only, no audio or words). */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const events = Array.isArray(b.events) ? b.events.slice(0, 60).map((e: unknown) => String(e).slice(0, 200)) : [];
    await q("insert into webhook_events (source, external_id, event, signature_ok, payload) values ('browser', $1, $2, true, $3) on conflict do nothing",
      [String(b.room ?? "unknown").slice(0, 80), `diag-${Date.now()}`, JSON.stringify({ events })]);
  } catch { /* best effort */ }
  return NextResponse.json({ ok: true });
}
