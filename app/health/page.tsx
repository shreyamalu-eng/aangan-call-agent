import { runHealth } from "@/lib/health";
import { q } from "@/lib/db";
import { CardHead, Empty, fmtIST } from "@/components/ui";
import { OPTIONAL } from "@/lib/env";

export const dynamic = "force-dynamic";

const GROUP: Record<string, string> = { core: "Core", vaani: "Vaani", telegram: "Telegram", hubspot: "HubSpot", calcom: "Cal.com", resend: "Resend (email)", ai: "AI second opinion", dashboard: "Dashboard" };

const Status = ({ ok }: { ok: boolean }) => <span className={`pill ${ok ? "good" : "bad"}`}><span aria-hidden="true">{ok ? "✓" : "✕"}</span>{ok ? "OK" : "Failing"}</span>;

export default async function Health() {
  const h = await runHealth({ deep: false });
  let last: any[] = [];
  try { last = await q("select checked_at, ok, results from health_checks order by checked_at desc limit 1"); } catch { /* db down */ }
  const deep = last[0];
  return (
    <>
      <header className="page-head">
        <div><h1>Health</h1><p className="sub">Live database check now; provider checks from the last 5-minute job. Failures alert on Telegram and by email.</p></div>
      </header>

      <section className="card">
        <CardHead title="Services" sub={deep ? `Providers checked ${fmtIST(deep.checked_at)}` : "Providers not checked yet"} />
        <div className="tablewrap">
          <table className="stackable">
            <caption className="visually-hidden">Service status</caption>
            <thead><tr><th>Service</th><th>Status</th><th className="num">ms</th><th>Detail</th></tr></thead>
            <tbody>
              <tr><td className="lead"><b>Neon (live)</b></td><td data-label="Status"><Status ok={h.checks.neon.ok} /></td><td data-label="ms" className="num">{h.checks.neon.ms}</td><td data-label="Detail">{h.checks.neon.detail ?? `Last call logged ${fmtIST(h.lastCall)}`}</td></tr>
              {deep && Object.entries(deep.results as Record<string, any>).filter(([k]) => k !== "neon").map(([k, c]) => (
                <tr key={k}><td className="lead"><b style={{ textTransform: "capitalize" }}>{k}</b></td><td data-label="Status"><Status ok={c.ok} /></td><td data-label="ms" className="num">{c.ms}</td><td data-label="Detail">{c.detail ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {!deep && <Empty>The GitHub Actions job hasn't run yet. Provider checks appear here after its first run.</Empty>}
      </section>

      <section className="card">
        <CardHead title="Configuration" sub="Which settings are present. Values are never shown." />
        <div className="legend"><span><span className="tag good">✓ set</span></span><span><span className="tag">○ optional, default in use</span></span><span><span className="tag bad">✕ required, missing</span></span></div>
        <ul className="rows">
          {Object.entries(h.env).map(([g, ks]) => (
            <li key={g}>
              <b>{GROUP[g] ?? g}</b>
              <div className="tags">{Object.entries(ks).map(([k, v]) => {
                const opt = !v && OPTIONAL[k];
                return <span key={k} className={`tag ${v ? "good" : opt ? "" : "bad"}`} title={opt || undefined}><span aria-hidden="true">{v ? "✓" : opt ? "○" : "✕"}</span>{k}<span className="visually-hidden">{v ? " set" : opt ? ` optional, not set: ${opt}` : " missing"}</span></span>;
              })}</div>
              {Object.entries(ks).filter(([k, v]) => !v && OPTIONAL[k]).map(([k]) => <p key={k} className="sub" style={{ fontSize: 13 }}><code>{k}</code> {OPTIONAL[k]}</p>)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
