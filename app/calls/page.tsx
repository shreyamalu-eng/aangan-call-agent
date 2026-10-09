import Link from "next/link";
import { callList } from "@/lib/queries";
import { isAdmin } from "@/lib/auth";
import { maskPhone } from "@/lib/normalize";
import { StatusPill, Empty, fmtIST, fmtDur } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";

export const dynamic = "force-dynamic";

export default async function Calls({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const f = await searchParams;
  const admin = await isAdmin();
  let rows: any[] = [];
  let error: string | null = null;
  try { rows = await callList(f); } catch (e) { error = String(e).slice(0, 200); }

  return (
    <>
      <header>
        <h1>All calls</h1>
        <p className="sub">Every completed call, qualified or not, with its recording and transcript. Newest first.</p>
      </header>
      <FilterBar f={f} base="/calls" />
      {f.archived && <p className="banner" role="status">Replayed test rows archived (hidden, not deleted).</p>}
      {error ? <p className="banner" role="alert">Couldn't load calls: {error}</p> : rows.length === 0 ? (
        <div className="card"><Empty>No calls match these filters. {Object.keys(f).length ? <Link href="/calls">Clear filters</Link> : "Make a test call from Vaani to see it here."}</Empty></div>
      ) : (
        <div className="card tablewrap">
          <table className="stack">
            <caption className="visually-hidden">{rows.length} calls</caption>
            <thead><tr><th>When (IST)</th><th>Outcome</th><th>Caller</th><th>Locality</th><th className="hide-sm">Property</th><th className="num hide-sm">Length</th><th>Designer</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="When"><Link href={`/calls/${r.id}`}>{fmtIST(r.started_at)}</Link>{!r.in_hours && <span className="tag" style={{ marginLeft: 6 }}>after hours</span>}{r.is_test && <span className="tag" style={{ marginLeft: 6 }}>replay</span>}</td>
                  <td data-label="Outcome"><StatusPill status={r.status} />{r.call_count > 1 && <span className="tag" style={{ marginLeft: 6 }}>{r.call_count} calls merged</span>}{r.state === "failed" && <span className="tag" style={{ marginLeft: 6 }}>processing failed</span>}</td>
                  <td data-label="Caller">{r.full_name ? (admin ? r.full_name : r.full_name.split(" ")[0]) : "—"}<br /><span className="sub" style={{ fontSize: 13 }}>{admin ? r.phone_e164 ?? "no number" : maskPhone(r.phone_e164)}</span></td>
                  <td data-label="Locality">{r.locality ?? "—"}</td>
                  <td data-label="Property" className="hide-sm">{r.size_text ?? r.segment ?? "—"}</td>
                  <td data-label="Length" className="num hide-sm">{fmtDur(r.duration_s)}</td>
                  <td data-label="Designer">{r.claimed_by_name ?? (r.sent_at ? "Unclaimed" : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
