import { PRESETS, presetRange, presetLabel, withParams } from "./period";

const KEEP = ["outcome", "area", "tests", "from", "to"] as const;

/** Props for <DateFilter>: the current label and one link per preset, keeping the other filters. */
export function dateMenu(base: string, f: Record<string, string | undefined>) {
  const kept = Object.fromEntries(KEEP.map((k) => [k, f[k]]));
  return {
    current: presetLabel(f),
    options: PRESETS.map((p) => { const r = presetRange(p.days); return { label: p.label, href: withParams(base, kept, { from: r.from, to: r.to }) }; }),
  };
}
