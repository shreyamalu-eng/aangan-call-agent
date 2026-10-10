import Link from "next/link";
import { notFound } from "next/navigation";
import { enquiryDetail } from "@/lib/queries";
import { isAdmin, canSeePii } from "@/lib/auth";
import { maskPhone } from "@/lib/normalize";
import { StatusPill, fmtIST, fmtDur, inr } from "@/components/ui";

export const dynamic = "force-dynamic";

const NAMES: Record<string, string> = { real_project: "Real project", service_area: "Service area", timeline: "Timeline", budget: "Budget", decision_maker: "Decision-maker" };
const MARK: Record<string, [string, string]> = { pass: ["✓", "Pass"], fail: ["✕", "Fail"], unclear: ["?", "Unclear (noted)"], not_mentioned: ["✓", "Not mentioned (passes)"] };

export default async function CallDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await enquiryDetail(id);
  if (!d) notFound();
  const admin = await isAdmin();
  const pii = await canSeePii();
  const { e, calls, verdict: v } = d;
  const hits: number[] = (v?.price_hits ?? []).map((h: any) => h.turn);

  return (
    <>
      <p><Link href="/calls">← All calls</Link></p>
      <header className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>{e.full_name ? (pii ? e.full_name : e.full_name.split(" ")[0]) : "Caller"} · {e.locality ?? "area not given"}</h1>
          <p className="sub">{fmtIST(calls[0]?.started_at)} · {calls.length > 1 ? `${calls.length} calls merged into one enquiry` : fmtDur(calls[0]?.duration_s)} · {pii ? e.phone_e164 ?? "no number" : maskPhone(e.phone_e164)}{e.is_test ? " · replayed transcript" : ""}</p>
        </div>
        <div className="row"><StatusPill status={e.status} />{e.priority !== "normal" && <span className="tag">{e.priority.replace(/_/g, " ")}</span>}</div>
      </header>
      {sp.saved && <p className="banner" role="status">Outcome saved and HubSpot updated.</p>}

      <section className="grid two">
        <div className="card">
          <h2>Five criteria</h2>
          {v ? (
            <ul className="crit">
              {Object.keys(NAMES).filter((k) => v.criteria[k]).map((k) => [k, v.criteria[k]] as [string, { result: string; evidence: string }]).map(([k, c]) => (
                <li key={k}><span aria-hidden="true">{MARK[c.result]?.[0] ?? "?"}</span><b>{NAMES[k] ?? k}<span className="visually-hidden">: {MARK[c.result]?.[1]}</span></b><span className="ev">{c.evidence || <span className="sub">{MARK[c.result]?.[1]}</span>}</span></li>
              ))}
            </ul>
          ) : <p className="sub">Verdict pending.</p>}
          {v?.engine && <p className="sub" style={{ fontSize: 13 }}>Judged by: {v.engine}. Routing decided in code.</p>}
        </div>
        <div className="card">
          <h2>Handoff</h2>
          <dl className="kv">
            <dt>Scope</dt><dd>{e.scope_text ?? "—"}</dd>
            <dt>Property</dt><dd>{e.size_text ?? e.segment ?? "—"}</dd>
            <dt>Timeline</dt><dd>{e.timeline_text ?? "—"}</dd>
            <dt>Decision</dt><dd>{e.decision_text ?? "—"}</dd>
            <dt>Loves / avoid</dt><dd>{e.likes || e.dislikes ? `${e.likes ?? "—"} / ${e.dislikes ?? "—"}` : "—"}</dd>
            <dt>Source</dt><dd>{e.source ?? "—"}</dd>
            <dt>Preferred times</dt><dd>{e.preferred_slots ?? "—"}</dd>
            {e.status === "declined" && <><dt>Declined because</dt><dd>{(e.decline_criteria ?? []).map((c: string) => NAMES[c] ?? c).join(", ")}</dd></>}
            {e.follow_up_at && <><dt>Follow up on</dt><dd>{e.follow_up_at.toString().slice(0, 10)}</dd></>}
            <dt>Telegram</dt><dd>{e.sent_at ? `Sent ${fmtIST(e.sent_at)}` : "Not sent"}{e.claimed_at ? ` · claimed by ${e.claimed_by_name} at ${fmtIST(e.claimed_at)}` : e.sent_at ? " · unclaimed" : ""}</dd>
            {(e.passes ?? []).length > 0 && <><dt>Passed by</dt><dd>{e.passes.map((p: any) => `${p.name} (${p.reason})`).join(", ")}</dd></>}
            <dt>HubSpot</dt><dd>{e.hubspot_deal_id ? `Deal ${e.hubspot_deal_id}` : "—"}</dd>
            <dt>Consultation</dt><dd>{d.consults.find((c: any) => c.status === "booked") ? fmtIST(d.consults.find((c: any) => c.status === "booked").booked_start) : "Not booked yet"}</dd>
            <dt>Cost</dt><dd>{inr(d.cost?.inr ?? 0)}</dd>
          </dl>
          {v?.note_for_designer && v.note_for_designer !== "none" && <p><b>Notes for designer:</b> {v.note_for_designer}</p>}
          {(v?.fit_reasons ?? []).length > 0 && <p><b>Good fit because:</b> {v.fit_reasons.join(" ")}</p>}
          {(v?.watch_outs ?? []).length > 0 && <p><b>Watch for:</b> {v.watch_outs.join(" ")}</p>}
        </div>
      </section>

      {calls.map((c: any, i: number) => (
        <section key={c.id} className="card">
          <h2>{calls.length > 1 ? `Call ${i + 1} · ` : ""}Recording and transcript</h2>
          <p className="sub">{fmtIST(c.started_at)} · {fmtDur(c.duration_s)} · {c.in_hours ? "in hours" : "after hours"}{c.error ? ` · issues: ${c.error}` : ""}</p>
          {!e.is_test && <audio controls preload="none" src={`/api/recording/${c.id}`} style={{ width: "100%", marginBottom: 12 }}>Your browser can't play this recording.</audio>}
          {c.summary && <p><b>Summary:</b> {c.summary}</p>}
          {(c.turns ?? []).length ? (
            <ol className="turns" aria-label="Transcript">
              {c.turns.map((t: any, j: number) => (
                <li key={j} className={`${t.role} ${i === calls.length - 1 && hits.includes(j) ? "hit" : ""}`}>
                  <span className="who">{t.role === "agent" ? "Agent" : "Caller"}{i === calls.length - 1 && hits.includes(j) ? " · price figure detected" : ""}</span>{t.text}
                </li>
              ))}
            </ol>
          ) : <p className="sub">Transcript not available yet (still processing).</p>}
        </section>
      ))}

      <section className="card">
        <h2>Outcome</h2>
        {d.outcomes.length > 0 && <p className="sub">{d.outcomes.map((o: any) => `${o.stage.replace(/_/g, " ")} (${fmtIST(o.set_at)})`).join(" → ")}</p>}
        {admin ? (
          <form method="post" action="/api/admin/outcome" className="filters">
            <input type="hidden" name="enquiryId" value={e.id} />
            <label htmlFor="o-stage">Stage
              <select id="o-stage" name="stage" defaultValue="consultation_done">
                <option value="consultation_booked">Consultation booked</option>
                <option value="consultation_done">Consultation done</option>
                <option value="proposal">Proposal sent</option>
                <option value="signed">Signed</option>
                <option value="lost">Lost</option>
              </select>
            </label>
            <label htmlFor="o-value">Project value (₹, optional)<input id="o-value" name="value" inputMode="numeric" placeholder="1100000" /></label>
            <button type="submit">Save and update HubSpot</button>
          </form>
        ) : <p className="sub"><Link href="/login">Sign in</Link> to update the outcome.</p>}
      </section>
    </>
  );
}
