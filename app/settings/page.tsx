import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { CASES } from "@/eval/transcripts";
import { INBOUND } from "@/eval/inbound";
import { CardHead, CardError } from "@/components/ui";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  avg_project_value_inr: "Average project value (₹)",
  vaani_rate_inr_per_min: "Vaani rate (₹ per minute)",
  llm_rate_inr_per_1k_tokens: "Model rate (₹ per 1,000 tokens)",
  low_budget_lakh_per_room: "Below-scope threshold (lakh per room)",
  sla_l1_minutes: "Alert front desk lead after (min)",
  sla_l2_minutes: "Alert Nikhil after (min)",
  sla_breach_minutes: "SLA breach after (min)",
};
const HELP: Record<string, string> = {
  avg_project_value_inr: "Used for the estimated pipeline value.",
  low_budget_lakh_per_room: "Internal only. Never said to callers.",
};
const opt = (c: { id: string; expected: string; note?: string }) => <option key={c.id} value={c.id}>{c.id} · expected {c.expected}{c.note ? ` (${c.note})` : ""}</option>;

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!(await isAdmin())) redirect("/login");
  const sp = await searchParams;
  let settings: any[] | null = null;
  try { settings = await q("select key, value from settings order by key"); } catch { /* db down */ }
  const order = Object.keys(LABELS);
  const rows = (settings ?? []).filter((s) => LABELS[s.key]).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return (
    <>
      <header className="page-head">
        <div><h1>Settings</h1><p className="sub">Assumptions used in the numbers, the Vaani agent, and test tools.</p></div>
      </header>
      {sp.saved && <p className="banner ok" role="status">Assumptions saved.</p>}

      <section className="grid split">
        <div className="card">
          <CardHead title="Assumptions" sub="These change the numbers on Overview and Pipeline, and when late leads get escalated." />
          {!settings ? <CardError what="settings" retry="/settings" /> : (
            <form method="post" action="/api/admin/settings" className="form-grid">
              {rows.map((s) => (
                <label key={s.key} htmlFor={`s-${s.key}`} className={s.key === "avg_project_value_inr" ? "full" : undefined}>
                  {LABELS[s.key]}
                  <input id={`s-${s.key}`} name={s.key} defaultValue={s.value} inputMode="decimal" aria-describedby={HELP[s.key] ? `h-${s.key}` : undefined} />
                  {HELP[s.key] && <span id={`h-${s.key}`} className="sub" style={{ fontSize: 13, fontWeight: 400 }}>{HELP[s.key]}</span>}
                </label>
              ))}
              <div className="full" style={{ marginTop: 8 }}><button type="submit" className="btn block">Save assumptions</button></div>
            </form>
          )}
        </div>

        <div className="stack">
          <section className="card">
            <CardHead title="Vaani agent" />
            <p className="sub">Creates the agent if it's missing and pushes the prompt, greeting, FAQ, guardrails and extraction from <code>agent/blocks.ts</code>. Also runs after each deploy and every night.</p>
            <form method="post" action="/api/admin/sync-agent"><button type="submit" className="btn block">Sync agent to Vaani</button></form>
          </section>
          <section className="card">
            <CardHead title="Replay September enquiries" />
            <p className="sub">Runs real September enquiries through the full pipeline (Neon, Telegram, HubSpot, email) as labelled test rows. No Vaani minutes used. “All 39” takes about a minute.</p>
            <form method="post" action="/api/admin/replay" style={{ display: "grid", gap: 12 }}>
              <label htmlFor="case" style={{ display: "grid", gap: 8 }}>Enquiries
                <select id="case" name="caseId" defaultValue="ALL">
                  <optgroup label="Groups">
                    <option value="ALL">All 39 enquiries (calls, WhatsApp, forms)</option>
                    <option value="ALL_PHONE">All 19 phone calls</option>
                    <option value="ALL_WHATSAPP">All 10 WhatsApp threads</option>
                    <option value="ALL_FORMS">All 10 web forms</option>
                  </optgroup>
                  <optgroup label="Phone calls">{CASES.filter((c) => c.transcript).map(opt)}</optgroup>
                  <optgroup label="WhatsApp">{INBOUND.filter((c) => c.channel === "whatsapp").map(opt)}</optgroup>
                  <optgroup label="Web form">{INBOUND.filter((c) => c.channel === "web_form").map(opt)}</optgroup>
                </select>
              </label>
              <button type="submit" className="btn block">Replay</button>
            </form>
            <form method="post" action="/api/admin/archive-tests"><button type="submit" className="btn outline block">Archive all replayed rows</button></form>
          </section>
          {process.env.DASHBOARD_PASSWORD && <form method="post" action="/api/logout"><button type="submit" className="btn outline block">Sign out</button></form>}
        </div>
      </section>
    </>
  );
}
