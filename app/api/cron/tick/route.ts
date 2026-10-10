import { NextResponse } from "next/server";
import { q, one, setting } from "@/lib/db";
import { cronOk } from "@/lib/auth";
import { slaLevel } from "@/lib/sla";
import * as tg from "@/lib/telegram";
import { sendEmail } from "@/lib/email";
import { pullRecentCalls } from "@/lib/pullCalls";
import { runHealth } from "@/lib/health";
import { appUrl, has } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Runs every 5 minutes from GitHub Actions: SLA escalations, Vaani poll backup, health alerts. */
export async function GET(req: Request) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const out: Record<string, unknown> = {};

  // 1. SLA escalations on unclaimed handoffs.
  try {
    const [l1, l2, br] = await Promise.all([setting("sla_l1_minutes", "15"), setting("sla_l2_minutes", "30"), setting("sla_breach_minutes", "60")]);
    const open = await q<any>("select h.id, h.enquiry_id, h.sent_at, h.escalation_level, e.locality from handoffs h join enquiries e on e.id = h.enquiry_id where h.sent_at is not null and h.claimed_at is null and e.archived = false");
    let n = 0;
    for (const h of open) {
      const lvl = slaLevel(new Date(h.sent_at), new Date(), Number(l1), Number(l2), Number(br));
      if (lvl <= h.escalation_level) continue;
      await q("update handoffs set escalation_level = $2, sla_breached = $3 where id = $1", [h.id, lvl, lvl >= 3]);
      const link = `<a href="${appUrl()}/calls/${h.enquiry_id}">open lead</a>`;
      const who = lvl === 1 ? "front desk lead" : lvl === 2 ? "Nikhil" : "everyone";
      await tg.alert(`⏱ Lead in ${tg.esc(h.locality ?? "Pune")} unclaimed ${lvl === 3 ? "past 60 min — SLA breached" : lvl === 2 ? "30 min" : "15 min"} · alerting ${who} · ${link}`);
      if (lvl >= 2) await sendEmail({ to: process.env.FOUNDER_EMAIL || "", subject: `Unclaimed lead (${lvl === 3 ? "SLA breached" : "30 min"})`, html: `<p>A qualified lead in ${h.locality ?? "Pune"} hasn't been claimed.</p><p><a href="${appUrl()}/calls/${h.enquiry_id}">Open the lead</a></p>` });
      n++;
    }
    out.sla = { open: open.length, escalated: n };
  } catch (e) { out.sla = { error: String(e).slice(0, 200) }; }

  // 2. Backup poll: any Vaani call we never received a post-processing webhook for.
  if (has("VAANI_API_KEY")) {
    try { out.poll = await pullRecentCalls(25); }
    catch (e) { out.poll = { error: String(e).slice(0, 200) }; }
  }

  // 3. Health: alert on the first failure and on recovery (not every 5 minutes).
  const health = await runHealth({ deep: true });
  try {
    const prev = await q<{ ok: boolean }>("select ok from health_checks order by checked_at desc offset 1 limit 1");
    const wasOk = prev[0]?.ok ?? true;
    if (!health.ok && wasOk) {
      const bad = Object.entries(health.checks).filter(([, c]) => !c.ok).map(([k, c]) => `${k}: ${c.detail}`).join("\n");
      await tg.alert(`🔧 <b>Something broke</b>\n${tg.esc(bad)}\n<a href="${appUrl()}/health">health page</a>`);
      await sendEmail({ to: process.env.FOUNDER_EMAIL || process.env.TEAM_EMAIL || "", subject: "Aangan call agent: a service is down", html: `<pre>${bad}</pre><p><a href="${appUrl()}/health">Health page</a></p>` });
    } else if (health.ok && !wasOk) await tg.alert("✅ All services healthy again.");
  } catch { /* if Neon is down the alert above can't be deduplicated; GitHub Actions also fails the job */ }
  out.health = { ok: health.ok, checks: health.checks };

  return NextResponse.json(out, { status: health.ok ? 200 : 503 });
}
