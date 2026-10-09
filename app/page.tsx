import Link from "next/link";
import { overview, attention } from "@/lib/queries";
import { Kpi, StatusPill, HBars, Empty, fmtIST, fmtMins, inr } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";

export const dynamic = "force-dynamic";

const CRIT: Record<string, string> = { real_project: "Advice only / out of scope", service_area: "Outside Pune/PCMC", timeline: "Timeline under 6 weeks", budget: "Volunteered budget too low", decision_maker: "Not the decision-maker" };

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const f = await searchParams;
  let data: Awaited<ReturnType<typeof overview>> | null = null;
  let att: any[] = [];
  let error: string | null = null;
  try { [data, att] = await Promise.all([overview(f), attention()]); } catch (e) { error = String(e).slice(0, 200); }

  if (error || !data) {
    return (
      <>
        <h1>Overview</h1>
        <div className="banner" role="alert">Couldn't load numbers from the database. {error} <Link href="/health">Check health</Link></div>
      </>
    );
  }
  const k = data.k;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const pipeline = (k.qualified - 0) * data.avg;
  const maxHour = Math.max(1, ...data.byHour.map((h) => h.n));
  const hours = Array.from({ length: 24 }, (_, h) => data!.byHour.find((x) => x.hour === h) ?? { hour: h, n: 0, after: 0 });
  const afterShare = pct(k.after_hours, k.calls);

  return (
    <>
      <header>
        <h1>Overview</h1>
        <p className="sub">Every enquiry call the agent answered, what happened to it, and what it cost. Updates on every call.</p>
      </header>
      <FilterBar f={f} base="/" />

      <section aria-labelledby="att-h" className="card">
        <h2 id="att-h">Needs attention ({att.length})</h2>
        {att.length === 0 ? <Empty>All clear ✓</Empty> : (
          <ul className="grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {att.map((a) => (
              <li key={a.id} className="row">
                <StatusPill status={a.status} />
                <Link href={`/calls/${a.id}`}>{a.locality ?? "Area not given"} · {fmtIST(a.started_at)}</Link>
                {a.priority === "previously_dropped" && <span className="tag">previously dropped</span>}
                {a.sent_at && !a.claimed_at && a.escalation_level >= 1 && <span className="tag">unclaimed {a.escalation_level >= 3 ? "> 60 min" : a.escalation_level === 2 ? "> 30 min" : "> 15 min"}</span>}
                {(a.flags ?? []).filter((x: string) => ["price_figure_spoken", "frustrated", "wants_human"].includes(x)).map((x: string) => <span key={x} className="tag">{x.replace(/_/g, " ")}</span>)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Key numbers" className="grid kpis">
        <Kpi label="Calls answered" value={String(k.calls)} hint={`${afterShare} after hours · ${k.failed} failed to process`} />
        <Kpi label="Qualified" value={String(k.qualified)} hint={`${pct(k.qualified, k.calls)} of calls`} />
        <Kpi label="Call end → Telegram" value={fmtMins(k.median_to_telegram_s)} hint="median · target under 5 min" />
        <Kpi label="Telegram → claimed" value={fmtMins(k.median_to_claim_s)} hint={`median · ${k.claimed} claimed · target 60 min`} />
        <Kpi label="Consultations booked" value={String(k.booked)} hint={`of ${k.qualified} qualified`} />
        <Kpi label="Price figures spoken" value={String(k.price_slips)} hint="must stay 0" />
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Calls by hour (IST)</h2>
          <p className="sub" style={{ marginTop: -8, marginBottom: 12 }}>{afterShare} of calls came outside 10am–7pm. Hatched bars are after hours.</p>
          {k.calls === 0 ? <Empty>No calls yet. Make a test call from Vaani, or replay a transcript in Settings.</Empty> : (
            <figure style={{ margin: 0 }}>
              <div className="bars" role="img" aria-label={`Calls by hour of day. ${afterShare} after hours.`}>
                {hours.map((h) => <div key={h.hour} className={`bar ${h.hour < 10 || h.hour >= 19 ? "after" : ""}`} style={{ height: `${(h.n / maxHour) * 100}%` }} title={`${h.hour}:00 — ${h.n} calls`} />)}
              </div>
              <div className="axis" aria-hidden="true">{hours.map((h) => <span key={h.hour}>{h.hour % 3 === 0 ? h.hour : ""}</span>)}</div>
              <details><summary>Show table</summary>
                <table><thead><tr><th>Hour</th><th className="num">Calls</th></tr></thead><tbody>{hours.filter((h) => h.n).map((h) => <tr key={h.hour}><td>{h.hour}:00</td><td className="num">{h.n}</td></tr>)}</tbody></table>
              </details>
            </figure>
          )}
        </div>
        <div className="card">
          <h2>Outcomes</h2>
          <HBars label="Outcome split" rows={[
            { k: "Qualified", n: k.qualified }, { k: "Declined", n: k.declined }, { k: "Nurture", n: k.nurture },
            { k: "Complaint", n: k.complaints }, { k: "Designer to confirm", n: k.hold }, { k: "Other / dropped", n: k.other },
          ].filter((r) => r.n)} />
          {data.declinedBy.length > 0 && <>
            <h2 style={{ marginTop: 16 }}>Declined because</h2>
            <HBars label="Declines by failed criterion" rows={data.declinedBy.map((r) => ({ k: CRIT[r.k] ?? r.k, n: r.n }))} />
          </>}
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Funnel and pipeline</h2>
          <HBars label="Funnel" rows={[{ k: "Calls", n: k.calls }, { k: "Qualified", n: k.qualified }, { k: "Claimed", n: k.claimed }, { k: "Consultation booked", n: k.booked }, { k: "Signed", n: data.signed.n }]} />
          <p className="sub">Estimated pipeline: <b>{inr(pipeline)}</b> ({k.qualified} qualified × {inr(data.avg)} average project value, editable in Settings). Signed so far: {inr(data.signed.value)}. The full sales pipeline lives in HubSpot.</p>
        </div>
        <div className="card">
          <h2>What it costs</h2>
          <dl className="kv">
            <dt>Total</dt><dd>{inr(data.cost.total)}</dd>
            <dt>Per call</dt><dd>{k.calls ? inr(data.cost.total / k.calls) : "—"}</dd>
            <dt>Per qualified lead</dt><dd>{k.qualified ? inr(data.cost.total / k.qualified) : "—"}</dd>
            <dt>Per signed project</dt><dd>{data.signed.n ? inr(data.cost.total / data.signed.n) : "—"}</dd>
          </dl>
          <p className="sub" style={{ fontSize: 13 }}>Vaani minutes × the rate in Settings, plus model tokens. Telegram is free.</p>
        </div>
      </section>

      <section className="grid two">
        <div className="card"><h2>Qualified leads by source</h2><HBars label="Leads by source" rows={data.bySource} /></div>
        <div className="card"><h2>Calls by locality</h2><HBars label="Calls by locality" rows={data.byArea} /></div>
      </section>
    </>
  );
}
