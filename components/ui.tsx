import Link from "next/link";
import { Icon, type IconName } from "./icons";

export const STATUS_LABEL: Record<string, string> = {
  qualified: "Qualified", declined: "Declined", nurture: "Nurture", complaint: "Complaint",
  hold_designer_confirm: "Designer to confirm", non_enquiry: "Not an enquiry", incomplete: "Dropped / incomplete", new: "New",
};
const ICON: Record<string, string> = { qualified: "✓", declined: "✕", nurture: "↻", complaint: "!", hold_designer_confirm: "?", non_enquiry: "·", incomplete: "…", new: "·" };

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status}`}><span aria-hidden="true">{ICON[status] ?? "·"}</span>{STATUS_LABEL[status] ?? status}</span>;
}

/**
 * Change against the previous period of the same length. Hidden when there's nothing to compare
 * (all time, or the previous period had no data). Colour says better/worse; the arrow says up/down.
 */
export function ChangePill({ now, before, lowerIsBetter = false, period }: { now: number | null | undefined; before: number | null | undefined; lowerIsBetter?: boolean; period: string }) {
  if (now == null || before == null || !Number(before)) return null;
  const pct = Math.round(((Number(now) - Number(before)) / Number(before)) * 100);
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const better = dir === "flat" ? null : (dir === "down") === lowerIsBetter;
  const cls = better == null ? "" : better ? "good" : "bad";
  const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  return (
    <span className={`pill ${cls}`} title={`vs ${period}`}>
      <span aria-hidden="true">{arrow}</span>{Math.abs(pct)}%
      <span className="visually-hidden"> {dir === "flat" ? "no change" : dir} vs {period}</span>
    </span>
  );
}

export function Kpi({ icon, label, value, hint, pill }: { icon: IconName; label: string; value: string; hint?: React.ReactNode; pill?: React.ReactNode }) {
  return (
    <div className="card kpi">
      <div className="kpi-head">
        <span className="icon-tile"><Icon name={icon} /></span>
        <h2 className="label">{label}</h2>
        {pill}
      </div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function CardHead({ title, id, sub, children }: { title: string; id?: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card-head">
      <div>
        <h2 id={id}>{title}</h2>
        {sub ? <p className="sub" style={{ fontSize: 14, marginTop: 2 }}>{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Shown when a card's query failed: what failed, plus a way to try again. */
export function CardError({ what, retry }: { what: string; retry: string }) {
  return <p className="banner bad" role="alert">Couldn't load {what}. <Link href={retry}>Retry</Link> · <Link href="/health">Check health</Link></p>;
}

export const initialsOf = (name: string | null | undefined) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[0][0].toUpperCase() : "?";
};

export const fmtIST = (d: string | Date | null | undefined, withDay = true) =>
  d ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...(withDay ? { day: "numeric", month: "short" } : {}), hour: "numeric", minute: "2-digit" }).format(new Date(d)) : "—";
export const fmtDay = (d: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00Z`));
export const fmtDur = (s: number | string | null | undefined) => { const n = Number(s); return n ? `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, "0")}s` : "—"; };
export const fmtMins = (s: number | null | undefined) => (s == null ? "—" : s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)} min`);
export const inr = (n: number) => (n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`);
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function HBars({ rows, label, empty = "No data in this period yet." }: { rows: { k: string; n: number }[]; label: string; empty?: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ul className="hbars" aria-label={label}>
      {rows.map((r) => (
        <li className="hbar" key={r.k}>
          <span className="k">{r.k}</span>
          <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${max ? (r.n / max) * 100 : 0}%` }} /></span>
          <span className="n">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

/** Half-ring gauge in pure SVG. */
export function Gauge({ value, caption, label }: { value: number; caption: string; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  const r = 120, cx = 150, cy = 150;
  const arc = (t: number) => { const a = Math.PI * (1 - t); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const [sx, sy] = arc(0), [ex, ey] = arc(1), [vx, vy] = arc(v);
  return (
    <div className="gauge">
      <svg viewBox="0 0 300 175" role="img" aria-label={label}>
        <path className="track" d={`M${sx} ${sy} A${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" strokeWidth="26" strokeLinecap="round" />
        {v > 0 && <path className="fill" d={`M${sx} ${sy} A${r} ${r} 0 0 1 ${vx} ${vy}`} fill="none" strokeWidth="26" strokeLinecap="round" />}
        <text className="big" x={cx} y={cy - 18} textAnchor="middle">{Math.round(v * 100)}%</text>
        <text className="cap" x={cx} y={cy + 10} textAnchor="middle">{caption}</text>
      </svg>
    </div>
  );
}
