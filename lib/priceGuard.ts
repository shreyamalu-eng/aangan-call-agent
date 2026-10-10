/**
 * Deterministic check for price figures in AGENT turns. The agent may quote ONLY the indicative ranges
 * from pricing.md (as ranges, with the caveat). Any other figure, a single number, a total for the
 * caller's home, "rates start at…", multipliers or discounts are flagged. Sizes and dates are fine.
 */
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "rupee_symbol", re: /(₹|\brs\.?|\binr\b|rupees?|रुपये|रुपए|रु\.)\s*\d/i },
  { name: "lakh_crore", re: /\d[\d.,]*\s*(lakh|lakhs|lac|lacs|crore|cr\b|लाख|करोड़|कोटी)/i },
  { name: "per_sqft_money", re: /\d[\d,]*\s*(per|\/|a)\s*(sq\.?\s*ft|square\s*f(oo|ee)t)/i },
  { name: "thousand_money", re: /\d+\s*(k|thousand|हजार|हज़ार)\s*(per|rupees|₹|for)/i },
  { name: "starts_at", re: /(rates?|prices?|cost)\s+(start|begin)s?\s+(at|from)/i },
  { name: "costs_around", re: /(it'?ll|it will|would|typically)\s+(cost|be)\s+(around|about|roughly|approximately)/i },
  { name: "multiplier_cost", re: /\b\d+\s*(x|×|times)\s+(the\s+)?(cost|price)/i },
  { name: "discount", re: /\b(discount|offer price|special price)\b|छूट|सवलत/i },
];

/** pricing.md's indicative bands. Per sq ft of carpet area, except [3.5, 8] = lakh for a single room, all-in. */
export const APPROVED_RANGES: [number, number][] = [
  [1800, 2400], [2400, 3500], // residential standard, premium
  [1200, 1800], [1800, 2800], [2800, 4000], // commercial basic, mid-range, premium
  [3.5, 8], // single room, lakh all-in
];
const CUR = String.raw`(?:₹|\brs\.?|\binr\b|rupees?|रुपये|रुपए)?\s*`;
const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const SEP = String.raw`\s*(?:to|–|—|-|and|से|ते|पासून)\s*`;
const RANGE = new RegExp(`${CUR}${NUM}${SEP}${CUR}${NUM}(\\s*(?:lakh|lakhs|lac|लाख))?`, "gi");
const LUXURY = new RegExp(`${CUR}3,?500\\s*(?:\\+|plus|and above|and up|upwards|or more|onwards|से ऊपर|से अधिक|पेक्षा जास्त|पासून पुढे)`, "gi");
const toNum = (s: string) => Number(s.replace(/,/g, ""));

/** Removes the approved ranges so only unapproved money talk is left to check. */
export function stripApprovedPrices(text: string): string {
  return text
    .replace(RANGE, (m, a, b) => (APPROVED_RANGES.some(([x, y]) => x === toNum(a) && y === toNum(b)) ? " [indicative range] " : m))
    .replace(LUXURY, " [indicative range] ");
}

export type PriceHit = { turn: number; pattern: string; excerpt: string };

export function findPriceFigures(turns: { role: string; text: string }[]): PriceHit[] {
  const hits: PriceHit[] = [];
  turns.forEach((t, i) => {
    if (t.role !== "agent") return;
    const text = stripApprovedPrices(t.text);
    for (const p of PATTERNS) {
      const m = text.match(p.re);
      if (m) hits.push({ turn: i, pattern: p.name, excerpt: text.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 40) });
    }
  });
  return hits;
}
