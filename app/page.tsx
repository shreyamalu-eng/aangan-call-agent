import Link from "next/link";
import { overview, attention, kpiCounts } from "@/lib/queries";
import { previousPeriod, periodName, withParams } from "@/lib/period";
import { dateMenu } from "@/lib/dateMenu";
import { Kpi, ChangePill, StatusPill, HBars, Empty, CardHead, CardError, Gauge, fmtIST, fmtMins, inr, hourLabel } from "@/components/ui";
import { AreaChart } from "@/components/AreaChart";
import { DateFilter } from "@/components/DateFilter";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const CRIT: Record<string, string> = { real_project: "Advice only / out of scope", service_area: "Outside Pune/PCMC", timeline: "Timeline under 6 weeks", budget: "Volunteered budget too low", decision_maker: "Not the decision-maker" };
const afterHours = (h: number) => h < 10 || h >= 19;

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const f = await searchParams;
  const here = withParams("/", f, {});
  const menu = dateMenu("/", f);
  const prevF = previousPeriod(f);
  const period = periodName(f);

  const [dataR, attR, prevR] = await Promise.allSettled([overview(f), attention(), prevF ? kpiCounts(prevF) : Promise.resolve(null)]);
  const data = dataR.status === "fulfilled" ? dataR.value : null;
  const att = attR.status === "fulfilled" ? attR.value : null;
  const prev = prevR.status === "fulfilled" ? prevR.value : null;
  const prevOk = prev && prev.calls > 0; // partial state: no earlier data, so no change pills

  const head = (
    <header className="page-head">
      <div>
        <h1>Overview</h1>
        <p className="sub">Every enquiry call the agent answered, what happened to it, and what it cost.</p>
      </div>
      <DateFilter {...menu} />
    </header>
  );

  if (!data) {
    return <>{head}<CardError what="the numbers from the database" retry={here} /></>;
  }

  const k = data.k;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const pipeline = k.qualified * data.avg;
  const hours = Array.from({ length: 24 }, (_, h) => data.byHour.find((x) => x.hour === h) ?? { hour: h, n: 0, after: 0 });
  const afterShare = pct(k.after_hours, k.calls);
  const peak = hours.reduce((b, h) => (h.n > b.n ? h : b), hours[0]);
  const pill = (now: number | null, before: number | null | undefined, lowerIsBetter = false) =>
    prevOk ? <ChangePill now={now} before={before} lowerIsBetter={lowerIsBetter} period={period} /> : null;

  return (
    <>
      {head}

      <section className="grid ov-top" aria-label="Key numbers">
        <div className="kpis">
          <Kpi icon="phone" label="Calls answered" value={String(k.calls)} pill={pill(k.calls, prev?.calls)} hint={k.calls ? `${afterShare} after hours · ${k.failed} failed to process` : "No calls in this period"} />
          <Kpi icon="users" label="Qualified leads" value={String(k.qualified)} pill={pill(k.qualified, prev?.qualified)} hint={k.calls ? `${pct(k.qualified, k.calls)} of calls` : "No calls in this period"} />
          <Kpi icon="send" label="Call → Telegram" value={fmtMins(k.median_to_telegram_s)} pill={pill(k.median_to_telegram_s, prev?.median_to_telegram_s, true)} hint="median · target under 5 min" />
          <Kpi icon="calendar" label="Consultations booked" value={String(k.booked)} pill={pill(k.booked, prev?.booked)} hint={`of ${k.qualified} qualified`} />
        </div>
        <div className="card">
          <CardHead title="Claimed within 60 min" sub={`${k.claimed_60} of ${k.sent} leads sent to designers`} />
          {k.sent ? (
            <Gauge value={k.claimed_60 / k.sent} caption="claimed in time" label={`${Math.round((k.claimed_60 / k.sent) * 100)}% of ${k.sent} handed-off leads were claimed within 60 minutes.`} />
          ) : <Empty>No leads sent to designers in this period yet.</Empty>}
          <p className="sub" style={{ fontSize: 13, textAlign: "center" }}>Median time to claim: {fmtMins(k.median_to_claim_s)}</p>
          <Link className="btn outline block" href="/calls?outcome=qualified">See details</Link>
        </div>
      </section>

      <section className="grid ov-mid">
        <div className="card">
          <CardHead title="Calls by hour (IST)" sub={k.calls ? `${afterShare} of calls came outside 10am–7pm. Busiest: ${hourLabel(peak.hour)}.` : undefined} />
          {k.calls === 0 ? <Empty>No calls in this period. Make a test call from Vaani, or replay a transcript in <Link href="/settings">Settings</Link>.</Empty> : (
            <>
              <AreaChart
                points={hours.map((h) => ({ label: hourLabel(h.hour), v: h.n, tip: `${hourLabel(h.hour)} · ${h.n} call${h.n === 1 ? "" : "s"}` }))}
                bands={[[0, 9], [19, 23]]}
                summary={`Calls by hour of day, IST. ${k.calls} calls in total, busiest at ${hourLabel(peak.hour)} with ${peak.n}. ${afterShare} came after hours.`}
              />
              <div className="legend"><span><i style={{ background: "var(--band)" }} />After hours (before 10 am, after 7 pm)</span></div>
              <details className="alt"><summary>Show table</summary>
                <table className="simple"><caption className="visually-hidden">Calls by hour</caption><thead><tr><th>Hour</th><th className="num">Calls</th><th>When</th></tr></thead>
                  <tbody>{hours.filter((h) => h.n).map((h) => <tr key={h.hour}><td>{hourLabel(h.hour)}</td><td className="num">{h.n}</td><td>{afterHours(h.hour) ? "After hours" : "In hours"}</td></tr>)}</tbody></table>
              </details>
            </>
          )}
        </div>

        <div className="stack">
          <section className="card" aria-labelledby="attention" id="attention-card">
            <CardHead title={`Needs attention${att ? ` (${att.length})` : ""}`} id="attention"><Link href="/calls" className="btn outline sm">See all</Link></CardHead>
            {!att ? <CardError what="the attention list" retry={here} /> : att.length === 0 ? <Empty><p style={{ fontWeight: 600, color: "var(--ok-ink)" }}>All clear ✓</p><p style={{ fontSize: 14 }}>Nothing unclaimed, flagged or waiting on a designer.</p></Empty> : (
              <ul className="rows">
                {att.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <div className="line1">
                      <Link className="title" href={`/calls/${a.id}`}>{a.locality ?? "Area not given"}</Link>
                      <StatusPill status={a.status} />
                    </div>
                    <div className="tags">
                      <span className="sub" style={{ fontSize: 13 }}>{fmtIST(a.started_at)}</span>
                      {a.sent_at && !a.claimed_at && a.escalation_level >= 1 && <span className="tag bad"><span aria-hidden="true">⏱</span>unclaimed {a.escalation_level >= 3 ? "> 60 min" : a.escalation_level === 2 ? "> 30 min" : "> 15 min"}</span>}
                      {a.priority === "previously_dropped" && <span className="tag warn">previously dropped</span>}
                      {(a.flags ?? []).filter((x: string) => ["price_figure_spoken", "frustrated", "wants_human"].includes(x)).map((x: string) => <span key={x} className="tag bad">{x === "price_figure_spoken" ? "price figure spoken" : x.replace(/_/g, " ")}</span>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="cta-card">
            <h2><Icon name="compass" />How it works</h2>
            <p>Vaani answers, we check 5 things, designers claim on Telegram.</p>
            <a href="/components-map.html">See the call flow →</a>
          </div>
        </div>
      </section>

      <section className="grid three">
        <div className="card">
          <CardHead title="Outcomes" />
          <HBars label="Outcome split" rows={[
            { k: "Qualified", n: k.qualified }, { k: "Declined", n: k.declined }, { k: "Nurture", n: k.nurture },
            { k: "Complaint", n: k.complaints }, { k: "Designer to confirm", n: k.hold }, { k: "Other / dropped", n: k.other },
          ].filter((r) => r.n)} empty="No calls in this period yet." />
          {data.declinedBy.length > 0 && <>
            <h3>Declined because</h3>
            <HBars label="Declines by failed criterion" rows={data.declinedBy.map((r) => ({ k: CRIT[r.k] ?? r.k, n: r.n }))} />
          </>}
        </div>
        <div className="card">
          <CardHead title="Funnel and pipeline"><Link href={withParams("/pipeline", f, {})} className="btn outline sm">Open</Link></CardHead>
          <HBars label="Funnel" rows={[{ k: "Calls", n: k.calls }, { k: "Qualified", n: k.qualified }, { k: "Claimed", n: k.claimed }, { k: "Booked", n: k.booked }, { k: "Signed", n: data.signed.n }]} />
          <dl className="kv">
            <dt>Estimated pipeline</dt><dd>{inr(pipeline)}</dd>
            <dt>Signed so far</dt><dd>{inr(data.signed.value)}</dd>
          </dl>
          <p className="sub" style={{ fontSize: 13 }}>{k.qualified} qualified × {inr(data.avg)} average project value (editable in Settings).</p>
        </div>
        <div className="card">
          <CardHead title="What it costs" />
          <dl className="kv">
            <dt>Total</dt><dd>{inr(data.cost.total)}</dd>
            <dt>Per call</dt><dd>{k.calls ? inr(data.cost.total / k.calls) : "—"}</dd>
            <dt>Per qualified lead</dt><dd>{k.qualified ? inr(data.cost.total / k.qualified) : "—"}</dd>
            <dt>Per signed project</dt><dd>{data.signed.n ? inr(data.cost.total / data.signed.n) : "—"}</dd>
            <dt>Price figures spoken</dt>
            <dd>{k.price_slips > 0
              ? <span className="pill bad"><span aria-hidden="true">✕</span>{k.price_slips} · must stay 0</span>
              : <span className="pill good"><span aria-hidden="true">✓</span>0 · must stay 0</span>}</dd>
          </dl>
          <p className="sub" style={{ fontSize: 13 }}>Vaani minutes × the rate in Settings, plus model tokens. Telegram is free.</p>
        </div>
      </section>

      <section className="grid two">
        <div className="card"><CardHead title="Qualified leads by source" /><HBars label="Leads by source" rows={data.bySource} empty="No qualified leads in this period yet." /></div>
        <div className="card"><CardHead title="Calls by locality" /><HBars label="Calls by locality" rows={data.byArea} empty="No calls in this period yet." /></div>
      </section>
    </>
  );
}
