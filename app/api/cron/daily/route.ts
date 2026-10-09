import { NextResponse } from "next/server";
import { cronOk } from "@/lib/auth";
import { q } from "@/lib/db";
import { syncAgent } from "@/lib/syncAgent";
import { sendEmail } from "@/lib/email";
import { appUrl, has } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 00:05 IST: refresh "Today is …" in the Vaani prompt (the call is a closed bubble) and email Nikhil a digest. */
export async function GET(req: Request) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const out: Record<string, unknown> = {};
  if (has("VAANI_API_KEY")) {
    try { out.agent = await syncAgent({ sections: ["persona"] }); } catch (e) { out.agent = { error: String(e).slice(0, 200) }; }
  }
  try {
    const [d] = await q<any>(`select count(*)::int as calls,
        count(*) filter (where e.status='qualified')::int as qualified,
        count(*) filter (where e.status='complaint')::int as complaints,
        count(*) filter (where e.status='declined')::int as declined
      from calls c left join enquiries e on e.id = c.enquiry_id where c.created_at > now() - interval '1 day'`);
    const [u] = await q<any>(`select count(*)::int as n from handoffs where sent_at is not null and claimed_at is null`);
    if (process.env.FOUNDER_EMAIL) {
      await sendEmail({ to: process.env.FOUNDER_EMAIL, subject: `Aangan daily: ${d.calls} calls, ${d.qualified} qualified`, html: `<p>Last 24 hours: <b>${d.calls}</b> calls · <b>${d.qualified}</b> qualified · ${d.declined} declined · ${d.complaints} complaints.</p><p>Unclaimed right now: <b>${u.n}</b>.</p><p><a href="${appUrl()}">Open the dashboard</a></p>` });
    }
    out.digest = d;
  } catch (e) { out.digest = { error: String(e).slice(0, 200) }; }
  return NextResponse.json(out);
}
