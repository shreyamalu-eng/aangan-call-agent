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
    // Test replays never page anyone. Real escalations are grouped: one Telegram message and one email per run.
    const open = await q<any>("select h.id, h.enquiry_id, h.sent_at, h.escalation_level, e.locality from handoffs h join enquiries e on e.id = h.enquiry_id where h.sent_at is not null and h.claimed_at is null and e.archived = false and e.is_test is not true");
    const hits: { enquiry_id: string; locality: string | null; lvl: number }[] = [];
    for (const h of open) {
      const lvl = slaLevel(new Date(h.sent_at), new Date(), Number(l1), Number(l2), Number(br));
      if (lvl <= h.escalation_level) continue;
      await q("update handoffs set escalation_level = $2, sla_breached = $3 where id = $1", [h.id, lvl, lvl >= 3]);
      hits.push({ enquiry_id: h.enquiry_id, locality: h.locality, lvl });
    }
    const n = hits.length;
    if (n) {
      const age = (lvl: number) => (lvl === 3 ? "past 60 min — SLA breached" : lvl === 2 ? "30 min" : "15 min");
      const top = Math.max(...hits.map((x) => x.lvl));
      const who = top === 1 ? "front desk lead" : top === 2 ? "Nikhil" : "everyone";
      const lines = hits.map((x) => `• ${tg.esc(x.locality ?? "Pune")} — unclaimed ${age(x.lvl)} · <a href="${appUrl()}/calls/${x.enquiry_id}">open lead</a>`);
      await tg.alert(n === 1
        ? `⏱ Lead in ${tg.esc(hits[0].locality ?? "Pune")} unclaimed ${age(hits[0].lvl)} · alerting ${who} · <a href="${appUrl()}/calls/${hits[0].enquiry_id}">open lead</a>`
        : `⏱ <b>${n} leads unclaimed</b> · alerting ${who}\n${lines.join("\n")}`);
      const urgent = hits.filter((x) => x.lvl >= 2);
      if (urgent.length) await sendEmail({
        to: process.env.FOUNDER_EMAIL || "",
        subject: urgent.length === 1 ? `Unclaimed lead (${urgent[0].lvl === 3 ? "SLA breached" : "30 min"})` : `${urgent.length} unclaimed leads`,
        html: `<p>${urgent.length === 1 ? "A qualified lead hasn't" : `${urgent.length} qualified leads haven't`} been claimed.</p><ul>${urgent.map((x) => `<li>${x.locality ?? "Pune"} — ${age(x.lvl)} · <a href="${appUrl()}/calls/${x.enquiry_id}">open</a></li>`).join("")}</ul>`,
      });
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
