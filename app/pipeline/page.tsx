import Link from "next/link";
import { overview, qualifiedByDay, qualifiedLeads, firstCallDay } from "@/lib/queries";
import { canSeePii } from "@/lib/auth";
import { maskPhone } from "@/lib/normalize";
import { dayList, todayIST, addDays, withParams } from "@/lib/period";
import { dateMenu } from "@/lib/dateMenu";
import { CardHead, CardError, Empty, fmtIST, fmtDay, inr, initialsOf } from "@/components/ui";
import { AreaChart } from "@/components/AreaChart";
import { DateFilter } from "@/components/DateFilter";
import { Icon } from "@/components/icons";
import { LiveRefresh } from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

const STAGE: Record<string, string> = { consultation_booked: "Consultation booked", consultation_done: "Consultation done", proposal: "Proposal sent", signed: "Signed", lost: "Lost" };
const STAGE_CLS: Record<string, string> = { signed: "good", lost: "bad", proposal: "soft", consultation_done: "soft", consultation_booked: "soft" };
// HubSpot account for the "View in HubSpot" links (not a secret: it's in every HubSpot URL).
const HUBSPOT_PORTAL = process.env.HUBSPOT_PORTAL_ID || "247646990";
const HUBSPOT_HOST = process.env.HUBSPOT_UI_DOMAIN || "app-na2.hubspot.com";

export default async function Pipeline({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const f = await searchParams;
  const here = withParams("/pipeline", f, {});
  const pii = await canSeePii();

  const [ovR, dailyR, leadsR, firstR] = await Promise.allSettled([overview(f), qualifiedByDay(f), qualifiedLeads(f), firstCallDay()]);
  const ov = ovR.status === "fulfilled" ? ovR.value : null;
  const daily = dailyR.status === "fulfilled" ? dailyR.value : null;
  const leads = leadsR.status === "fulfilled" ? leadsR.value : null;
  const first = firstR.status === "fulfilled" ? firstR.value : null;

  const to = f.to || todayIST();
  const from = f.from || first || addDays(to, -29);
  const days = from <= to ? dayList(from, to) : [];
  const avg = ov?.avg ?? 0;
  const points = days.map((d) => {
    const n = daily?.find((x) => x.day === d)?.n ?? 0;
    return { label: fmtDay(d), v: n * avg, tip: `${fmtDay(d)} · ${n} qualified · ${inr(n * avg)}` };
  });
  const total = ov ? ov.k.qualified * avg : 0;

  const funnel = ov ? [
    { k: "Calls", n: ov.k.calls }, { k: "Qualified", n: ov.k.qualified }, { k: "Claimed", n: ov.k.claimed },
    { k: "Consultation booked", n: ov.k.booked }, { k: "Signed", n: ov.signed.n },
  ] : [];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="sub">Qualified leads, what they could be worth, and how far each one has got.</p>
        </div>
        <div className="btn-row" style={{ alignItems: "center" }}><LiveRefresh /><DateFilter {...dateMenu("/pipeline", f)} /></div>
      </header>

      <section className="grid split">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Estimated pipeline</h2>
              <p style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }} className="tabnum">{ov ? inr(total) : "—"}</p>
              <p className="sub" style={{ fontSize: 13 }}>Qualified leads per day × {inr(avg)} average project value (editable in <Link href="/settings">Settings</Link>)</p>
            </div>
          </div>
          {!ov || !daily ? <CardError what="the pipeline numbers" retry={here} /> : ov.k.qualified === 0 ? (
            <Empty>No qualified leads in this period yet. Try <Link href="/pipeline">All time</Link>.</Empty>
          ) : (
            <>
              <AreaChart points={points} yKind="inr" summary={`Estimated pipeline by day from ${fmtDay(from)} to ${fmtDay(to)}: ${inr(total)} in total from ${ov.k.qualified} qualified leads.`} />
              <details className="alt"><summary>Show table</summary>
                <table className="simple"><caption className="visually-hidden">Qualified leads per day</caption><thead><tr><th>Day</th><th className="num">Qualified</th><th className="num">Estimated value</th></tr></thead>
                  <tbody>{points.filter((p) => p.v).map((p) => <tr key={p.label}><td>{p.label}</td><td className="num">{Math.round(p.v / (avg || 1))}</td><td className="num">{inr(p.v)}</td></tr>)}</tbody></table>
              </details>
            </>
          )}
        </div>

        <div className="card">
          <CardHead title="Funnel" sub="Conversion from the step before" />
          {!ov ? <CardError what="the funnel" retry={here} /> : ov.k.calls === 0 ? <Empty>No calls in this period yet.</Empty> : (
            <ol className="rows funnel" aria-label="Funnel">
              {funnel.map((s, i) => (
                <li key={s.k}>
                  <span>{s.k}</span>
                  <span className="n">{s.n}</span>
                  <span className="pill soft tabnum" style={{ minWidth: 56, justifyContent: "center" }}>{i === 0 ? "—" : funnel[i - 1].n ? `${Math.round((s.n / funnel[i - 1].n) * 100)}%` : "—"}</span>
                </li>
              ))}
            </ol>
          )}
          {ov && <p className="sub" style={{ fontSize: 13 }}>Signed so far: <b>{inr(ov.signed.value)}</b>. The full sales pipeline lives in HubSpot.</p>}
        </div>
      </section>

      <section className="card" aria-labelledby="ql">
        <CardHead title="Qualified leads" id="ql" sub={leads ? `${leads.length} in this period` : undefined} />
        {!leads ? <CardError what="qualified leads" retry={here} /> : leads.length === 0 ? <Empty>No qualified leads in this period yet.</Empty> : (
          <div className="tablewrap">
            <table className="stackable">
              <caption className="visually-hidden">Qualified leads with stage, designer and consultation</caption>
              <thead><tr><th>Caller</th><th>Locality</th><th>Stage</th><th>Designer</th><th>Consultation</th><th>HubSpot</th><th><span className="visually-hidden">Open</span></th></tr></thead>
              <tbody>
                {leads.map((r) => {
                  const name = r.full_name ? (pii ? r.full_name : r.full_name.split(" ")[0]) : null;
                  return (
                    <tr key={r.id}>
                      <td className="lead"><div className="who"><span className="initials" aria-hidden="true">{initialsOf(name)}</span><div><b>{name ?? "Caller"}</b><span className="sub">{fmtIST(r.started_at)}</span><span className="sub">{pii ? r.phone_e164 ?? "no number" : maskPhone(r.phone_e164)}</span></div></div></td>
                      <td data-label="Locality">{r.locality ?? "—"}{r.is_test && <> <span className="tag">replay</span></>}</td>
                      <td data-label="Stage">{r.stage ? <span className={`pill ${STAGE_CLS[r.stage] ?? ""}`}>{STAGE[r.stage] ?? r.stage}</span> : r.claimed_by_name ? <span className="pill soft">Claimed</span> : r.sent_at ? <span className="pill warn">Waiting for a designer</span> : <span className="pill">Qualified</span>}</td>
                      <td data-label="Designer">{r.claimed_by_name ?? "—"}</td>
                      <td data-label="Consultation">{r.consult_at ? fmtIST(r.consult_at) : <Link href={`/calls/${r.id}#book`} className="btn outline sm">Book</Link>}</td>
                      <td data-label="HubSpot">{r.hubspot_deal_id ? <a href={`https://${HUBSPOT_HOST}/contacts/${HUBSPOT_PORTAL}/record/0-3/${r.hubspot_deal_id}`} target="_blank" rel="noopener noreferrer" className="nowrap">View in HubSpot<span className="visually-hidden"> (opens in a new tab)</span></a> : "—"}</td>
                      <td className="act"><Link href={`/calls/${r.id}`} className="iconbtn outline" aria-label={`Open call from ${fmtIST(r.started_at)}${r.locality ? `, ${r.locality}` : ""}`} title="Open call"><Icon name="eye" /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
