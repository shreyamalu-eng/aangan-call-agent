import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { verifySignature } from "@/lib/vaani";
import { processCall } from "@/lib/pipeline";
import { normalizePhone } from "@/lib/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * All Vaani events land here. Vaani retries non-2xx up to 5×, so every event is idempotent on
 * (call_id, event). We log call_started immediately (every call gets a row, even if it fails later)
 * and run the full pipeline on call_postprocessing.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = verifySignature(raw, req.headers.get("x-vaani-signature"), req.headers.get("x-vaani-timestamp"));
  if (sig === "bad") return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const event: string = body.event ?? body.type ?? "unknown";
  const data = body.data ?? body;
  const callId: string | undefined = data.call_id ?? body.call_id ?? data.room_name ?? body.room_name;

  const logged = await one<{ id: string }>(
    `insert into webhook_events (source, external_id, event, signature_ok, payload) values ('vaani',$1,$2,$3,$4)
     on conflict (source, external_id, event) do nothing returning id`,
    [callId ?? null, event, sig === "ok", body]);
  if (!logged && event === "call_postprocessing") {
    const done = await one("select 1 from calls where vaani_call_id = $1 and state = 'processed'", [callId]);
    if (done) return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (event === "call_started" && callId) {
      await q(`insert into calls (vaani_call_id, room_name, started_at, state) values ($1,$2,now(),'received') on conflict (vaani_call_id) do nothing`, [callId, data.room_name ?? null]);
    } else if (event === "call_ended" && callId) {
      await q(`update calls set ended_at = now(), end_reason = $2, duration_s = coalesce(duration_s, $3) where vaani_call_id = $1`, [callId, data.end_reason ?? null, data.call_duration ?? null]);
    } else if (event === "call_postprocessing" && callId) {
      // Caller ID arrives on call_started for phone calls (WebRTC test calls have none).
      const started = await one<{ payload: any }>("select payload from webhook_events where source='vaani' and external_id=$1 and event='call_started'", [callId]);
      const callerId = normalizePhone(started?.payload?.phone_number ?? started?.payload?.data?.phone_number ?? null);
      const res = await processCall({ ...data, call_id: callId, phone_number: callerId });
      if (logged) await q("update webhook_events set processed_at = now() where id = $1", [logged.id]);
      return NextResponse.json({ ok: true, ...res });
    }
    if (logged) await q("update webhook_events set processed_at = now() where id = $1", [logged.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (logged) await q("update webhook_events set error = $2 where id = $1", [logged.id, String(e).slice(0, 500)]);
    // 500 so Vaani retries; the 5-minute poll is the second safety net.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
