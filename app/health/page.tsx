import { runHealth } from "@/lib/health";
import { q } from "@/lib/db";
import { fmtIST } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Health() {
  const h = await runHealth({ deep: false });
  let last: any[] = [];
  try { last = await q("select checked_at, ok, results from health_checks order by checked_at desc limit 1"); } catch { /* db down */ }
  const deep = last[0];
  return (
    <>
      <header><h1>Health</h1><p className="sub">Live database check now; provider checks from the last 5-minute job. Failures alert on Telegram and by email.</p></header>
      <section className="card">
        <h2>{h.ok ? "✓ Database reachable" : "✕ Database unreachable"}</h2>
        <p className="sub">Neon answered in {h.checks.neon.ms} ms{h.checks.neon.detail ? ` · ${h.checks.neon.detail}` : ""}. Last call logged: {fmtIST(h.lastCall)}.</p>
      </section>
      <section className="card">
        <h2>Providers {deep ? `(checked ${fmtIST(deep.checked_at)})` : "(not checked yet)"}</h2>
        {deep ? (
          <table><thead><tr><th>Service</th><th>Status</th><th className="num">ms</th><th>Detail</th></tr></thead>
            <tbody>{Object.entries(deep.results as Record<string, any>).map(([k, c]) => <tr key={k}><td>{k}</td><td>{c.ok ? "✓ OK" : "✕ Failing"}</td><td className="num">{c.ms}</td><td>{c.detail ?? ""}</td></tr>)}</tbody></table>
        ) : <p className="sub">The GitHub Actions job hasn't run yet.</p>}
      </section>
      <section className="card">
        <h2>Configuration</h2>
        <table><thead><tr><th>Integration</th><th>Variables set</th></tr></thead>
          <tbody>{Object.entries(h.env).map(([g, ks]) => <tr key={g}><td>{g}</td><td>{Object.entries(ks).map(([k, v]) => <span key={k} className="tag" style={{ marginRight: 6, display: "inline-block", marginBottom: 4 }}>{v ? "✓" : "✕"} {k}</span>)}</td></tr>)}</tbody></table>
      </section>
    </>
  );
}
