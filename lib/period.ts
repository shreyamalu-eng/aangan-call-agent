/** Date ranges for the "Filter by date" menu and the KPI change pills. All dates are IST calendar days (YYYY-MM-DD). */
export const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

export const PRESETS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time", days: 0 },
] as const;

export function presetRange(days: number): { from?: string; to?: string } {
  if (!days) return {};
  const to = todayIST();
  return { from: addDays(to, -(days - 1)), to };
}

/** Which preset the current URL matches, or "Custom range" when the dates were typed on /calls. */
export function presetLabel(f: { from?: string; to?: string }) {
  if (!f.from && !f.to) return "All time";
  const hit = PRESETS.find((p) => { const r = presetRange(p.days); return r.from === f.from && r.to === f.to; });
  return hit?.label ?? "Custom range";
}

/** The period of the same length just before the selected one. None for "All time" (nothing to compare against). */
export function previousPeriod<T extends { from?: string; to?: string }>(f: T): (T & { from: string; to: string }) | null {
  if (!f.from || !/^\d{4}-\d{2}-\d{2}$/.test(f.from)) return null;
  const to = f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to) ? f.to : todayIST();
  const len = daysBetween(f.from, to) + 1;
  if (len < 1) return null;
  return { ...f, from: addDays(f.from, -len), to: addDays(f.from, -1) };
}

export function periodName(f: { from?: string; to?: string }) {
  const p = previousPeriod(f);
  if (!p) return "";
  const len = daysBetween(p.from, p.to) + 1;
  return len === 1 ? "the day before" : `the previous ${len} days`;
}

/** Every day in the range, for the pipeline chart. Capped at 180 points. */
export function dayList(from: string, to: string) {
  const out: string[] = [];
  const n = Math.min(daysBetween(from, to), 179);
  for (let i = n; i >= 0; i--) out.push(addDays(to, -i));
  return out;
}

/** Build a URL keeping the current filters, with some keys changed. */
export function withParams(base: string, f: Record<string, string | undefined>, change: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...change })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
