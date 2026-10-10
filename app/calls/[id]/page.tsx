import Link from "next/link";
import { notFound } from "next/navigation";
import { enquiryDetail } from "@/lib/queries";
import { isAdmin, canSeePii } from "@/lib/auth";
import { maskPhone } from "@/lib/normalize";
import { StatusPill, CardHead, fmtIST, fmtDur, inr } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const NAMES: Record<string, string> = { real_project: "Real project", service_area: "Service area", timeline: "Timeline", budget: "Budget", decision_maker: "Decision-maker" };
const MARK: Record<string, [string, string, string]> = { pass: ["✓", "Pass", "pass"], fail: ["✕", "Fail", "fail"], unclear: ["?", "Unclear (noted)", "unclear"], not_mentioned: ["✓", "Not mentioned (passes)", "pass"] };

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
  const booked = d.consults.find((c: any) => c.status === "booked");

  return (
    <>
      <p><Link href="/calls" className="back"><Icon name="chevLeft" />All calls</Link></p>
      <header className="page-head">
        <div>
          <h1>{e.full_name ? (pii ? e.full_name : e.full_name.split(" ")[0]) : "Caller"} · {e.locality ?? "area not given"}</h1>
          <p className="sub">{fmtIST(calls[0]?.started_at)} · {calls.length > 1 ? `${calls.length} calls merged into one enquiry` : fmtDur(calls[0]?.duration_s)} · {pii ? e.phone_e164 ?? "no number" : maskPhone(e.phone_e164)}{e.is_test ? " · replayed transcript" : ""}</p>
        </div>
        <div className="tags"><StatusPill status={e.status} />{e.priority !== "normal" && <span className="tag warn">{e.priority.replace(/_/g, " ")}</span>}</div>
      </header>
      {sp.saved && <p className="banner ok" role="status">Outcome saved and HubSpot updated.</p>}

      <section className="grid two">
        <div className="card">
          <CardHead title="Five criteria" sub={v?.engine ? `Judged by ${v.engine}. Routing decided in code.` : undefined} />
          {v ? (
            <ul className="crit">
              {Object.keys(NAMES).filter((k) => v.criteria[k]).map((k) => [k, v.criteria[k]] as [string, { result: string; evidence: string }]).map(([k, c]) => {
                const m = MARK[c.result] ?? ["?", c.result, "unclear"];
                return (
                  <li key={k}>
                    <span className={`mark ${m[2]}`} aria-hidden="true">{m[0]}</span>
                    <div><b>{NAMES[k] ?? k}</b> <span className="sub" style={{ fontSize: 13 }}>· {m[1]}</span><div className="ev">{c.evidence || m[1]}</div></div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="sub">Verdict pending. It appears a minute or so after the call ends.</p>}
        </div>
        <div className="card">
          <CardHead title="Handoff" />
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
            <dt>Consultation</dt><dd>{booked ? fmtIST(booked.booked_start) : "Not booked yet"}</dd>
            <dt>Cost</dt><dd>{inr(d.cost?.inr ?? 0)}</dd>
          </dl>
          {v?.note_for_designer && v.note_for_designer !== "none" && <p><b>Notes for designer:</b> {v.note_for_designer}</p>}
          {(v?.fit_reasons ?? []).length > 0 && <p><b>Good fit because:</b> {v.fit_reasons.join(" ")}</p>}
          {(v?.watch_outs ?? []).length > 0 && <p><b>Watch for:</b> {v.watch_outs.join(" ")}</p>}
        </div>
      </section>

      {calls.map((c: any, i: number) => {
        const last = i === calls.length - 1;
        return (
          <section key={c.id} className="card">
            <CardHead title={`${calls.length > 1 ? `Call ${i + 1} · ` : ""}Recording and transcript`} sub={`${fmtIST(c.started_at)} · ${fmtDur(c.duration_s)} · ${c.in_hours ? "in hours" : "after hours"}${c.error ? ` · issues: ${c.error}` : ""}`} />
            {!e.is_test && <audio controls preload="none" src={`/api/recording/${c.id}`}>Your browser can't play this recording.</audio>}
            {c.summary && <p><b>Summary:</b> {c.summary}</p>}
            {(c.turns ?? []).length ? (
              <ol className="turns" aria-label="Transcript">
                {c.turns.map((t: any, j: number) => {
                  const hit = last && hits.includes(j);
                  return (
                    <li key={j} className={`${t.role} ${hit ? "hit" : ""}`}>
                      <span className="who-l">{t.role === "agent" ? "Agent" : "Caller"}{hit && <> · <b>Price figure detected</b></>}</span>{t.text}
                    </li>
                  );
                })}
              </ol>
            ) : <p className="sub">Transcript not available yet (still processing).</p>}
          </section>
        );
      })}

      <section className="card">
        <CardHead title="Outcome" sub={d.outcomes.length > 0 ? d.outcomes.map((o: any) => `${o.stage.replace(/_/g, " ")} (${fmtIST(o.set_at)})`).join(" → ") : "No outcome recorded yet."} />
        {admin ? (
          <form method="post" action="/api/admin/outcome" className="form-grid">
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
            <div className="full"><button type="submit" className="btn">Save and update HubSpot</button></div>
          </form>
        ) : <p className="sub"><Link href="/login">Sign in</Link> to update the outcome.</p>}
      </section>
    </>
  );
}
