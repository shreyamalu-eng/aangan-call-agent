import { NextResponse } from "next/server";
import { cronOk, isAdmin } from "@/lib/auth";
import { processCall, type Channel } from "@/lib/pipeline";
import { CASES } from "@/eval/transcripts";
import { INBOUND } from "@/eval/inbound";

export const runtime = "nodejs";
export const maxDuration = 300;

type Replayable = { id: string; channel: Channel; date: string; phone: string | null; name: string | null; transcript: string; second?: { date: string; transcript: string } };

/** Every September enquiry in one list: 19 calls (T08 has no transcript), 10 WhatsApp threads, 10 web forms. */
const ALL: Replayable[] = [
  ...CASES.filter((c) => c.transcript).map((c) => ({ id: c.id, channel: "phone" as Channel, date: c.date, phone: c.phone, name: null, transcript: c.transcript, second: c.secondCall })),
  ...INBOUND.map((c) => ({ id: c.id, channel: c.channel as Channel, date: c.date, phone: c.phone, name: c.name, transcript: c.transcript })),
];

const GROUPS: Record<string, (r: Replayable) => boolean> = {
  ALL: () => true,
  ALL_PHONE: (r) => r.channel === "phone",
  ALL_WHATSAPP: (r) => r.channel === "whatsapp",
  ALL_FORMS: (r) => r.channel === "web_form",
};

/**
 * Replays September enquiries through the real pipeline (Neon, Telegram, HubSpot, email) as
 * labelled test rows, at their original date and time. No Vaani minutes used.
 * Each run gets fresh phone numbers, so replaying twice never merges into the last run's rows.
 */
export async function POST(req: Request) {
  if (!cronOk(req) && !(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const isJson = req.headers.get("content-type")?.includes("json");
  const form = isJson ? await req.json() : Object.fromEntries((await req.formData()).entries());
  const key = String(form.caseId ?? "");
  const pick = GROUPS[key] ? ALL.filter(GROUPS[key]) : ALL.filter((r) => r.id === key);
  if (!pick.length) return NextResponse.json({ error: `Unknown case "${key}"` }, { status: 400 });

  const run = Date.now().toString(36);
  const salt = String(Math.floor(1000 + Math.random() * 8999));
  const started = Date.now();
  const results: { id: string; outcome?: string; enquiryId?: string; error?: string }[] = [];
  for (const r of pick) {
    if (Date.now() - started > 270_000) { results.push({ id: r.id, error: "skipped: time limit, replay this one on its own" }); continue; }
    const phone = r.phone ? r.phone.slice(0, -4) + salt : null;
    try {
      const res: any = await processCall({
        call_id: `replay-${r.id}-${run}`, transcript: r.transcript, started_at: r.date,
        call_duration: r.channel === "phone" ? 240 : undefined,
        entities: { callback_number: phone, caller_name: r.name }, summary: `Replay of ${r.id} (${r.channel.replace("_", " ")})`,
      }, { isTest: true, channel: r.channel });
      if (r.second) {
        const res2: any = await processCall({ call_id: `replay-${r.id}-b-${run}`, transcript: r.second.transcript, started_at: r.second.date, call_duration: 270, entities: { callback_number: phone }, summary: `Replay of ${r.id} (second call)` }, { isTest: true, channel: r.channel });
        results.push({ id: r.id, outcome: res2.outcome, enquiryId: res2.enquiryId });
      } else results.push({ id: r.id, outcome: res.outcome, enquiryId: res.enquiryId });
    } catch (e) {
      results.push({ id: r.id, error: String(e).slice(0, 200) });
    }
  }

  if (!isJson) {
    if (results.length === 1 && results[0].enquiryId) return NextResponse.redirect(new URL(`/calls/${results[0].enquiryId}`, req.url), 303);
    return NextResponse.redirect(new URL(`/calls?tests=1&replayed=${results.filter((r) => r.outcome).length}`, req.url), 303);
  }
  return NextResponse.json({ replayed: results.filter((r) => r.outcome).length, results });
}
