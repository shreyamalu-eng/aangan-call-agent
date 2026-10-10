import { NextResponse } from "next/server";
import { triggerCall } from "@/lib/vaani";

export const runtime = "nodejs";

/** Indian 10-digit numbers get +91; anything else must already be +countrycode. */
function toE164(raw: string) {
  const s = raw.replace(/[\s().-]/g, "");
  if (/^\+\d{10,15}$/.test(s)) return s;
  if (/^0?\d{10}$/.test(s)) return `+91${s.slice(-10)}`;
  if (/^91\d{10}$/.test(s)) return `+${s}`;
  return null;
}

/**
 * Starts a call from the dashboard. The Vaani key stays on the server.
 * {medium:"webrtc"} → LiveKit token + URL for a browser call.
 * {medium:"telephony", number, name} → Vaani rings that number.
 */
export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  try {
    if (body.medium === "webrtc") {
      const r = await triggerCall({ medium: "webrtc", primary_language: "hi", secondary_language: "en" }) // matches the agent: Hindi with English fallback;
      const url = r?.connection_url ?? r?.url ?? r?.livekit_url;
      if (!r?.token || !url) return NextResponse.json({ error: "Vaani didn't return a call link." }, { status: 502 });
      return NextResponse.json({ token: r.token, url, room: r.room_name ?? null });
    }
    if (body.medium === "telephony") {
      const number = toE164(String(body.number ?? ""));
      if (!number) return NextResponse.json({ error: "Enter a 10-digit Indian number, or a number starting with + and the country code." }, { status: 400 });
      const name = String(body.name ?? "").trim().slice(0, 60) || "Caller";
      const r = await triggerCall({ medium: "telephony", contact_number: number, name });
      return NextResponse.json({ ok: true, number: `${number.slice(0, 3)} ••••• ${number.slice(-4)}`, callId: r?.call_id ?? r?.room_name ?? null });
    }
    return NextResponse.json({ error: "Unknown call type." }, { status: 400 });
  } catch (e) {
    const msg = String(e);
    const friendly = /401|Invalid API key/i.test(msg) ? "Vaani rejected the API key. Add a new key, then try again."
      : /VAANI_AGENT_ID/.test(msg) ? "No Vaani agent is set up yet. Run 'Sync agent to Vaani' in Settings."
      : `Vaani couldn't start the call: ${msg.replace(/^Error: /, "").slice(0, 200)}`;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
