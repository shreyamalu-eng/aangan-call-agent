import { NextResponse } from "next/server";
import { availableSlots, pickSlots } from "@/lib/calcom";
import { toolAuthOk, toolParams, say, ist } from "@/lib/agentTools";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Vaani custom tool "check_consultation_times". Input: preference (the caller's words, e.g. "Saturday morning").
 * Returns up to 3 open consultation times that fit, with a sentence to read out.
 */
async function handle(req: Request) {
  if (!toolAuthOk(req)) return NextResponse.json({ ok: false, message: "unauthorised" }, { status: 401 });
  const p = await toolParams(req);
  const preference = String(p.preference ?? p.preferred_times ?? p.preferred_slots ?? "").slice(0, 200) || null;
  try {
    const picks = pickSlots(await availableSlots(45), preference, 3);
    if (!picks.length) return say("I can't see open consultation times in the calendar right now. I'll note the times that suit you and a designer will confirm.", { ok: false, options: [] });
    const options = picks.map((iso, i) => ({ option: i + 1, start_iso: iso, label: ist(iso) }));
    return say(`I have ${options.map((o) => o.label).join("; or ")}. Which one suits you?`, { options });
  } catch (e) {
    console.error("[tool slots]", e);
    return say("I can't reach the calendar right now. I'll note the times that suit you and a designer will confirm.", { ok: false, options: [] });
  }
}
export const GET = handle;
export const POST = handle;
