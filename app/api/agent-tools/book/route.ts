import { NextResponse } from "next/server";
import { availableSlots } from "@/lib/calcom";
import { bookFromCall } from "@/lib/booking";
import { normalizePhone, normalizeEmail } from "@/lib/normalize";
import { toolAuthOk, toolParams, say, ist } from "@/lib/agentTools";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Vaani custom tool "book_consultation". Input: start_iso (one of the times from check_consultation_times),
 * caller_name, callback_number, optional email, summary (scope, property, area), call_id if available.
 */
export async function POST(req: Request) {
  if (!toolAuthOk(req)) return NextResponse.json({ ok: false, message: "unauthorised" }, { status: 401 });
  const p = await toolParams(req);
  const start = new Date(String(p.start_iso ?? p.start ?? p.slot ?? ""));
  if (Number.isNaN(start.getTime())) return say("I need to pick one of the times I offered. Which one would you like?", { ok: false });
  if (start.getTime() < Date.now()) return say("That time has already passed. Let me offer you another one.", { ok: false });
  const phone = normalizePhone(String(p.callback_number ?? p.phone ?? p.phone_number ?? "")) ?? null;
  const email = normalizeEmail(String(p.email ?? "")) ?? null;
  const name = String(p.caller_name ?? p.name ?? "").trim().slice(0, 60);
  if (!phone) return say("Before I book, could you give me the best number to reach you on?", { ok: false });
  try {
    // Only book a time that is genuinely still open.
    const open = await availableSlots(45);
    if (!open.some((s) => Math.abs(new Date(s).getTime() - start.getTime()) < 60_000)) {
      return say("That time was just taken. Let me check the next open times for you.", { ok: false });
    }
    const r = await bookFromCall({ startIso: start.toISOString(), name, phone, email, callRef: p.call_id ? String(p.call_id) : null, notes: String(p.summary ?? p.notes ?? "").slice(0, 600) });
    return say(`You're booked for ${ist(start.toISOString())}. A designer will call you before then to confirm the details.`, { booked_for: r.when });
  } catch (e) {
    const msg = String(e);
    if (/already booked/.test(msg)) return say("You already have a consultation booked with us, so I won't book a second one. A designer will be in touch to confirm it.", { ok: false });
    console.error("[tool book]", e);
    return say("I couldn't complete the booking just now. I've noted the time you chose and a designer will confirm it with you.", { ok: false });
  }
}
