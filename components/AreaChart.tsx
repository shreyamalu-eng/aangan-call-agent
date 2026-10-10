"use client";
import { useEffect, useId, useRef, useState } from "react";

export type Point = { label: string; v: number; tip: string };

/** Monotone cubic (Fritsch–Carlson): smooth, never overshoots below 0 or above the real peaks. */
function smoothPath(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = xs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let p = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (xs[i + 1] - xs[i]) / 3;
    p += ` C${xs[i] + h},${ys[i] + m[i] * h} ${xs[i + 1] - h},${ys[i + 1] - m[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return p;
}

function niceMax(max: number) {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max / 4)));
  const k = [1, 2, 2.5, 5, 10].find((s) => (s * step * 4) >= max) ?? 10;
  return k * step * 4;
}

const fmtY = (v: number, kind: "int" | "inr") =>
  kind === "inr" ? (v === 0 ? "₹0" : v >= 1e7 ? `₹${+(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : `₹${Math.round(v / 1000)}k`) : String(Math.round(v));

/**
 * Smooth area chart. Hover or keyboard (arrow keys, Home/End) shows a tooltip for one real data point.
 * Width follows its card, so text stays at 12px on phones too.
 */
export function AreaChart({ points, summary, bands = [], yKind = "int", height = 260 }: {
  points: Point[]; summary: string; bands?: [number, number][]; yKind?: "int" | "inr"; height?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = w < 480 ? Math.min(height, 200) : height;
  const pad = { l: yKind === "inr" ? 52 : 34, r: 10, t: 14, b: 28 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const n = points.length;
  const max = niceMax(Math.max(0, ...points.map((p) => p.v)));
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const xs = points.map((_, i) => x(i)), ys = points.map((p) => y(p.v));
  const line = smoothPath(xs, ys);
  const area = n > 1 ? `${line} L${xs[n - 1]},${pad.t + ih} L${xs[0]},${pad.t + ih} Z` : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));
  const half = n > 1 ? iw / (n - 1) / 2 : iw / 2;

  const nearest = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const px = clientX - r.left;
    return Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const cur = active ?? 0;
    const next = e.key === "ArrowRight" ? cur + 1 : e.key === "ArrowLeft" ? cur - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next == null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(n - 1, next)));
  };
  const peak = points.reduce((b, p, i) => (p.v > points[b].v ? i : b), 0);

  return (
    <div className="chart" ref={wrap}>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${summary} Use the left and right arrow keys to read each point.`}
        onKeyDown={onKey}
        onFocus={() => setActive((a) => a ?? peak)}
        onBlur={() => setActive(null)}
        onPointerMove={(e) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
        className="chart-focus"
      >
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={summary}>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="stop-a" />
              <stop offset="100%" className="stop-b" />
            </linearGradient>
          </defs>
          {bands.map(([a, b]) => (
            <rect key={`${a}-${b}`} className="band" x={Math.max(pad.l, x(a) - half)} y={pad.t} width={Math.min(pad.l + iw, x(b) + half) - Math.max(pad.l, x(a) - half)} height={ih} />
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid-line" x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} />
              <text className="axis-text" x={pad.l - 8} y={y(t) + 4} textAnchor="end">{fmtY(t, yKind)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % every === 0 ? <text key={i} className="axis-text" x={x(i)} y={h - 6} textAnchor={i === 0 && n > 1 ? "start" : "middle"}>{p.label}</text> : null))}
          {area && <path d={area} fill={`url(#g${gid})`} />}
          <path className="line" d={line} />
          {n === 1 && active == null && <circle className="dot" cx={xs[0]} cy={ys[0]} r={6} />}
          {active != null && (
            <>
              <line className="guide" x1={xs[active]} x2={xs[active]} y1={pad.t} y2={pad.t + ih} />
              <circle className="dot" cx={xs[active]} cy={ys[active]} r={6} />
            </>
          )}
        </svg>
        {active != null && <div className="tip" style={{ left: Math.min(Math.max(xs[active], 60), w - 60), top: ys[active] }}>{points[active].tip}</div>}
      </div>
      <p className="visually-hidden" aria-live="polite">{active != null ? points[active].tip : ""}</p>
    </div>
  );
}
