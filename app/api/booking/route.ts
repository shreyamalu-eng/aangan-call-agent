import { NextResponse } from "next/server";
import { bookConsultation } from "@/lib/booking";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Book from the dashboard. {enquiryId, designer, start, calendar}
 * start: ISO time of a Cal.com slot (calendar=true), or "YYYY-MM-DDTHH:mm" in IST for a time agreed by phone.
 */
export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const designer = String(b.designer ?? "").trim().slice(0, 60);
  if (!/^[0-9a-f-]{36}$/i.test(String(b.enquiryId ?? ""))) return NextResponse.json({ error: "Unknown lead." }, { status: 400 });
  if (!designer) return NextResponse.json({ error: "Enter the designer's name." }, { status: 400 });
  const raw = String(b.start ?? "");
  const d = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00+05:30` : raw);
  if (!raw || Number.isNaN(d.getTime())) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  const startIso = d.toISOString();
  if (Date.parse(startIso) < Date.now() - 5 * 60e3) return NextResponse.json({ error: "That time is in the past." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await bookConsultation({ enquiryId: b.enquiryId, startIso, designer, calendar: Boolean(b.calendar) })) });
  } catch (e) {
    const msg = String(e).replace(/^Error: /, "");
    return NextResponse.json({ error: /already/.test(msg) ? msg : `Couldn't book: ${msg.slice(0, 200)}` }, { status: 502 });
  }
}
