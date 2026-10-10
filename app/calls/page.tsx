import Link from "next/link";
import { callList } from "@/lib/queries";
import { canSeePii } from "@/lib/auth";
import { maskPhone } from "@/lib/normalize";
import { withParams } from "@/lib/period";
import { StatusPill, Empty, CardError, fmtIST, fmtDur, initialsOf } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";
import { Icon } from "@/components/icons";
import { CallPanel } from "@/components/CallPanel";
import { LiveRefresh } from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

export default async function Calls({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const f = await searchParams;
  const pii = await canSeePii();
  let rows: any[] = [];
  let error: string | null = null;
  try { rows = await callList(f); } catch (e) { error = String(e).slice(0, 200); }
  const filtered = ["outcome", "from", "to", "area", "tests"].some((k) => f[k]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Calls</h1>
          <p className="sub">Start a call with the agent, then see every call with its recording, transcript and verdict. Phone numbers are masked.</p>
        </div>
        <LiveRefresh />
      </header>
      {f.archived && <p className="banner ok" role="status">Replayed test rows archived (hidden, not deleted).</p>}
      {f.replayed && <p className="banner ok" role="status">{f.replayed} test enquiries replayed. They're tagged “replay” below.</p>}

      <CallPanel />

      <section className="card" aria-labelledby="all-calls">
        <div className="card-head">
          <h2 id="all-calls">All calls{!error ? <span className="sub" style={{ fontWeight: 500, fontSize: 15 }}> · {rows.length}</span> : null}</h2>
          <form action="/calls" method="get" role="search" className="search" style={{ flex: "0 1 340px" }}>
            {["outcome", "from", "to", "tests"].map((k) => f[k] ? <input key={k} type="hidden" name={k} value={f[k]} /> : null)}
            <label htmlFor="q-card" className="visually-hidden">Search calls by locality</label>
            <Icon name="search" />
            <input id="q-card" name="area" type="search" defaultValue={f.area ?? ""} placeholder="Search by locality" />
          </form>
        </div>
        <FilterBar f={f} base="/calls" />

        {error ? <CardError what="calls" retry={withParams("/calls", f, {})} /> : rows.length === 0 ? (
          <Empty>
            {filtered ? <>No calls match these filters. <Link href="/calls">Clear filters</Link></> : "No calls yet. Make a test call from Vaani to see it here."}
          </Empty>
        ) : (
          <div className="tablewrap">
            <table className="stackable">
              <caption className="visually-hidden">{rows.length} calls, newest first</caption>
              <thead><tr><th>Caller</th><th>When (IST)</th><th>Outcome</th><th>Locality</th><th className="hide-sm">Property</th><th>Length</th><th>Designer</th><th><span className="visually-hidden">Open</span></th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const name = r.full_name ? (pii ? r.full_name : r.full_name.split(" ")[0]) : null;
                  return (
                    <tr key={r.id}>
                      <td className="lead">
                        <div className="who">
                          <span className="initials" aria-hidden="true">{initialsOf(name)}</span>
                          <div><b>{name ?? "Caller"}</b><span className="sub">{pii ? r.phone_e164 ?? "no number" : maskPhone(r.phone_e164)}</span></div>
                        </div>
                      </td>
                      <td data-label="When"><div className="nowrap">{fmtIST(r.started_at)}</div>
                        {(!r.in_hours || r.is_test) && <div className="tags" style={{ marginTop: 4 }}>{!r.in_hours && <span className="tag">after hours</span>}{r.is_test && <span className="tag">replay</span>}</div>}
                      </td>
                      <td data-label="Outcome"><div className="tags"><StatusPill status={r.status} />{r.call_count > 1 && <span className="tag">{r.call_count} calls merged</span>}{r.state === "failed" && <span className="tag bad">processing failed</span>}</div></td>
                      <td data-label="Locality">{r.locality ?? "—"}</td>
                      <td data-label="Property" className="hide-sm">{r.size_text ?? r.segment ?? "—"}</td>
                      <td data-label="Length"><span className="pill soft tabnum">{fmtDur(r.duration_s)}</span></td>
                      <td data-label="Designer">{r.claimed_by_name ?? (r.sent_at ? <span className="tag warn">Unclaimed</span> : "—")}</td>
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
