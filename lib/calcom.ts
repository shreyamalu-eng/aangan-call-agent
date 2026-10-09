/** Cal.com API v2. Used only AFTER a designer claims a lead (Vaani's in-call booking stays off). */
import { fetchJson } from "./http";

const BASE = "https://api.cal.com/v2";
const h = (version: string) => {
  const k = process.env.CALCOM_API_KEY;
  if (!k) throw new Error("CALCOM_API_KEY is not set");
  return { Authorization: `Bearer ${k}`, "cal-api-version": version, "Content-Type": "application/json" };
};

let cachedEventTypeId: number | null = null;
export async function eventTypeId(): Promise<number> {
  if (process.env.CALCOM_EVENT_TYPE_ID) return Number(process.env.CALCOM_EVENT_TYPE_ID);
  if (cachedEventTypeId) return cachedEventTypeId;
  const r = await fetchJson<any>(`${BASE}/event-types`, { headers: h("2024-06-14") });
  const list: any[] = Array.isArray(r?.data) ? r.data : r?.data?.eventTypeGroups?.flatMap((g: any) => g.eventTypes) ?? [];
  const slug = (process.env.CALCOM_EVENT_SLUG || "").toLowerCase();
  const chosen = list.find((e) => slug && e.slug?.toLowerCase() === slug) ?? list[0];
  if (!chosen) throw new Error("No Cal.com event types found for this API key");
  cachedEventTypeId = Number(chosen.id);
  return cachedEventTypeId;
}

export async function availableSlots(days = 7): Promise<string[]> {
  const id = await eventTypeId();
  const start = new Date();
  const end = new Date(start.getTime() + days * 864e5);
  const qs = new URLSearchParams({ eventTypeId: String(id), start: start.toISOString(), end: end.toISOString(), timeZone: "Asia/Kolkata" });
  const r = await fetchJson<any>(`${BASE}/slots?${qs}`, { headers: h("2024-09-04") });
  const data = r?.data ?? {};
  return Object.values(data).flat().map((s: any) => (typeof s === "string" ? s : s.start)).filter(Boolean).sort();
}

export async function book(p: { start: string; name: string; email: string; phone?: string | null; notes: string }) {
  const id = await eventTypeId();
  const body: any = {
    start: new Date(p.start).toISOString(),
    eventTypeId: id,
    attendee: { name: p.name, email: p.email, timeZone: "Asia/Kolkata", language: "en", ...(p.phone ? { phoneNumber: p.phone } : {}) },
    metadata: { source: "aangan-call-agent" },
    bookingFieldsResponses: { notes: p.notes.slice(0, 900) },
  };
  try {
    const r = await fetchJson<any>(`${BASE}/bookings`, { method: "POST", headers: h("2024-08-13"), body: JSON.stringify(body) });
    return r?.data as { uid: string; start: string };
  } catch (e) {
    delete body.bookingFieldsResponses; delete body.attendee.phoneNumber;
    const r = await fetchJson<any>(`${BASE}/bookings`, { method: "POST", headers: h("2024-08-13"), body: JSON.stringify(body) });
    return r?.data as { uid: string; start: string };
  }
}

/**
 * Picks up to 3 open slots that fit what the caller asked for ("weekday evenings", "Saturday morning",
 * "this week or next"). Fewer, better options make the designer's choice faster.
 */
export function pickSlots(slots: string[], preference: string | null, max = 3): string[] {
  const p = (preference || "").toLowerCase();
  const dayWords = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wantDays = new Set<number>();
  dayWords.forEach((d, i) => { if (p.includes(d)) wantDays.add(i); });
  if (/weekend/.test(p)) { wantDays.add(0); wantDays.add(6); }
  if (/weekday/.test(p)) [1, 2, 3, 4, 5].forEach((d) => wantDays.add(d));
  const after = p.match(/after\s*(\d{1,2})\s*(pm)?/);
  const wantPart = /morning/.test(p) ? "morning" : /afternoon/.test(p) ? "afternoon" : /evening|after\s*[5-9]/.test(p) ? "evening" : null;
  const ist = (s: string) => { const d = new Date(new Date(s).getTime() + 5.5 * 36e5); return { day: d.getUTCDay(), hour: d.getUTCHours() }; };
  const fits = (s: string) => {
    const { day, hour } = ist(s);
    if (wantDays.size && !wantDays.has(day)) return false;
    if (after) { const hh = Number(after[1]) + (Number(after[1]) < 12 ? 12 : 0); if (hour < hh) return false; }
    if (wantPart === "morning" && hour >= 12) return false;
    if (wantPart === "afternoon" && (hour < 12 || hour >= 16)) return false;
    if (wantPart === "evening" && hour < 16) return false;
    return true;
  };
  const matching = slots.filter(fits);
  const pool = matching.length ? matching : slots;
  // Spread across different days rather than three slots on the same morning.
  const out: string[] = [];
  const seenDays = new Set<string>();
  for (const s of pool) { const k = s.slice(0, 10); if (!seenDays.has(k)) { out.push(s); seenDays.add(k); } if (out.length === max) break; }
  for (const s of pool) { if (out.length === max) break; if (!out.includes(s)) out.push(s); }
  return out;
}

export async function ping() {
  await eventTypeId();
  return true;
}
