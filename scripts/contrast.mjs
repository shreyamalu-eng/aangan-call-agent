// Checks every colour pair the dashboard uses, in both themes. Run: node scripts/contrast.mjs
// Text needs 4.5:1. Borders, icons, chart lines and the focus ring need 3:1.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const block = (re) => Object.fromEntries([...(css.match(re)?.[1] ?? "").matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const light = block(/:root\s*\{([^}]*)\}/);
const dark = { ...light, ...block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/) };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = 4.5, UI = 3;
const pairs = [
  ["text", "bg", TEXT], ["text", "surface", TEXT], ["text-2", "surface", TEXT],
  ["muted", "bg", TEXT], ["muted", "surface", TEXT], ["muted", "surface-2", TEXT],
  ["primary-ink", "surface", TEXT], ["primary-ink", "bg", TEXT], ["primary-ink", "surface-2", TEXT],
  ["on-primary", "primary-ink", TEXT], ["on-cta", "cta", TEXT],
  ["up-ink", "up-bg", TEXT], ["down-ink", "down-bg", TEXT], ["ok-ink", "ok-bg", TEXT],
  ["info-ink", "info-bg", TEXT], ["hold-ink", "hold-bg", TEXT], ["muted", "neutral-bg", TEXT],
  ["down-ink", "surface", TEXT],
  ["border", "surface", UI], ["border", "bg", UI],
  ["primary", "surface", UI], ["primary", "surface-2", UI], ["primary", "bg", UI],
  ["band", "surface", 1], // after-hours shading: decorative, labelled in text
];

let fails = 0;
for (const [name, t] of [["Light", light], ["Dark", dark]]) {
  console.log(`\n${name} theme`);
  for (const [fg, bg, min] of pairs) {
    if (min === 1) continue;
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${`--${fg} on --${bg}`.padEnd(32)} ${r.toFixed(2)}:1  (needs ${min}:1)`);
  }
}
console.log(fails ? `\n${fails} pair(s) fail.` : "\nEvery pair passes.");
process.exit(fails ? 1 : 0);
