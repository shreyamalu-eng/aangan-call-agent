import { NextResponse } from "next/server";
import { cronOk, isAdmin } from "@/lib/auth";
import { processCall } from "@/lib/pipeline";
import { CASES } from "@/eval/transcripts";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Replays a September transcript through the real pipeline (Neon, Telegram, HubSpot, email),
 * marked as a test row. Lets you prove the whole flow without spending Vaani minutes.
 */
export async function POST(req: Request) {
  if (!cronOk(req) && !(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const form = req.headers.get("content-type")?.includes("json") ? await req.json() : Object.fromEntries((await req.formData()).entries());
  const c = CASES.find((x) => x.id === String(form.caseId));
  if (!c || !c.transcript) return NextResponse.json({ error: "unknown case or no transcript" }, { status: 400 });
  const stamp = Date.now();
  const res = await processCall({ call_id: `replay-${c.id}-${stamp}`, transcript: c.transcript, started_at: new Date().toISOString(), call_duration: 240, entities: { callback_number: c.phone }, summary: `Replay of ${c.id}` }, { isTest: true });
  if (c.secondCall) {
    await processCall({ call_id: `replay-${c.id}-b-${stamp}`, transcript: c.secondCall.transcript, started_at: new Date(Date.now() + 1000).toISOString(), call_duration: 270, entities: { callback_number: c.phone }, summary: `Replay of ${c.id} (second call)` }, { isTest: true });
  }
  if (!req.headers.get("content-type")?.includes("json")) return NextResponse.redirect(new URL(`/calls/${res.enquiryId ?? ""}`, req.url), 303);
  return NextResponse.json(res);
}
