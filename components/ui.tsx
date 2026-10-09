import Link from "next/link";

export const STATUS_LABEL: Record<string, string> = {
  qualified: "Qualified", declined: "Declined", nurture: "Nurture", complaint: "Complaint",
  hold_designer_confirm: "Designer to confirm", non_enquiry: "Not an enquiry", incomplete: "Dropped / incomplete", new: "New",
};
const ICON: Record<string, string> = { qualified: "✓", declined: "✕", nurture: "↻", complaint: "!", hold_designer_confirm: "?", non_enquiry: "·", incomplete: "…", new: "·" };

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status}`}><span aria-hidden="true">{ICON[status] ?? "·"}</span>{STATUS_LABEL[status] ?? status}</span>;
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export const fmtIST = (d: string | Date | null | undefined, withDay = true) =>
  d ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...(withDay ? { day: "numeric", month: "short" } : {}), hour: "numeric", minute: "2-digit" }).format(new Date(d)) : "—";
export const fmtDur = (s: number | string | null | undefined) => { const n = Number(s); return n ? `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, "0")}s` : "—"; };
export const fmtMins = (s: number | null | undefined) => (s == null ? "—" : s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)} min`);
export const inr = (n: number) => (n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`);

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function HBars({ rows, label }: { rows: { k: string; n: number }[]; label: string }) {
  if (!rows.length) return <Empty>No data yet.</Empty>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <div className="grid" role="list" aria-label={label}>
      {rows.map((r) => (
        <div className="hbar" role="listitem" key={r.k}>
          <span>{r.k}</span>
          <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${(r.n / max) * 100}%`, display: "block" }} /></span>
          <span className="num">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href}>{children}</Link>;
}
