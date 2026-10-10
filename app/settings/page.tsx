import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { CASES } from "@/eval/transcripts";
import { INBOUND } from "@/eval/inbound";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  avg_project_value_inr: "Average project value (₹) — used for pipeline value",
  vaani_rate_inr_per_min: "Vaani rate (₹ per minute)",
  llm_rate_inr_per_1k_tokens: "Model rate (₹ per 1,000 tokens)",
  low_budget_lakh_per_room: "‘Clearly below scope’ threshold (lakh per room, internal only)",
  sla_l1_minutes: "Alert front desk lead after (min)",
  sla_l2_minutes: "Alert Nikhil after (min)",
  sla_breach_minutes: "SLA breach after (min)",
};

export default async function Settings() {
  if (!(await isAdmin())) redirect("/login");
  let settings: any[] = [];
  try { settings = await q("select key, value from settings order by key"); } catch { /* db down */ }
  return (
    <>
      <header><h1>Settings</h1><p className="sub">Assumptions used in the numbers, the Vaani agent, and test tools.</p></header>
      <section className="card">
        <h2>Vaani agent</h2>
        <p className="sub">Creates the agent if it's missing and pushes the prompt, greeting, FAQ, guardrails and extraction from <code>agent/blocks.ts</code>. Runs automatically after each deploy and every night (date line).</p>
        <form method="post" action="/api/admin/sync-agent"><button type="submit">Sync agent to Vaani now</button></form>
      </section>
      <section className="card">
        <h2>Replay September enquiries</h2>
        <p className="sub">Runs real September enquiries through the full pipeline (Neon, Telegram, HubSpot, email) as labelled test rows. No Vaani minutes used. "All 39" takes about a minute.</p>
        <form method="post" action="/api/admin/replay" className="filters">
          <label htmlFor="case">Transcript
            <select id="case" name="caseId" defaultValue="ALL">
              <optgroup label="Groups">
                <option value="ALL">All 39 enquiries (calls, WhatsApp, forms)</option>
                <option value="ALL_PHONE">All 19 phone calls</option>
                <option value="ALL_WHATSAPP">All 10 WhatsApp threads</option>
                <option value="ALL_FORMS">All 10 web forms</option>
              </optgroup>
              <optgroup label="Phone calls">{CASES.filter((c) => c.transcript).map((c) => <option key={c.id} value={c.id}>{c.id} · expected {c.expected}{c.note ? ` (${c.note})` : ""}</option>)}</optgroup>
              <optgroup label="WhatsApp">{INBOUND.filter((c) => c.channel === "whatsapp").map((c) => <option key={c.id} value={c.id}>{c.id} · expected {c.expected}{c.note ? ` (${c.note})` : ""}</option>)}</optgroup>
              <optgroup label="Web form">{INBOUND.filter((c) => c.channel === "web_form").map((c) => <option key={c.id} value={c.id}>{c.id} · expected {c.expected}{c.note ? ` (${c.note})` : ""}</option>)}</optgroup>
            </select>
          </label>
          <button type="submit">Replay</button>
        </form>
        <form method="post" action="/api/admin/archive-tests" style={{ marginTop: 12 }}><button type="submit" className="secondary">Archive all replayed rows</button></form>
      </section>
      <section className="card">
        <h2>Assumptions</h2>
        <form method="post" action="/api/admin/settings" className="grid" style={{ maxWidth: 520 }}>
          {settings.filter((s) => LABELS[s.key]).map((s) => (
            <label key={s.key} htmlFor={`s-${s.key}`} style={{ display: "grid", gap: 4 }}>{LABELS[s.key]}
              <input id={`s-${s.key}`} name={s.key} defaultValue={s.value} inputMode="decimal" />
            </label>
          ))}
          <button type="submit">Save assumptions</button>
        </form>
      </section>
      <form method="post" action="/api/logout"><button type="submit" className="secondary">Sign out</button></form>
      <p><Link href="/health">Health →</Link></p>
    </>
  );
}
