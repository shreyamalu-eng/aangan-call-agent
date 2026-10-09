/**
 * Deterministic check for price figures in AGENT turns. pricing.md forbids any number, range or
 * per-sq-ft figure. Sizes ("1,400 sq ft") and dates are fine; money is not.
 */
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "rupee_symbol", re: /(₹|\brs\.?|\binr\b|rupees?|रुपये|रुपए|रु\.)\s*\d/i },
  { name: "lakh_crore", re: /\d[\d.,]*\s*(lakh|lakhs|lac|lacs|crore|cr\b|लाख|करोड़|कोटी)/i },
  { name: "per_sqft_money", re: /\d[\d,]*\s*(per|\/|a)\s*(sq\.?\s*ft|square\s*f(oo|ee)t)/i },
  { name: "thousand_money", re: /\d+\s*(k|thousand|हजार|हज़ार)\s*(per|rupees|₹|for)/i },
  { name: "starts_at", re: /(rates?|prices?|cost)\s+(start|begin)s?\s+(at|from)/i },
  { name: "costs_around", re: /(it'?ll|it will|would|typically)\s+(cost|be)\s+(around|about|roughly|approximately)/i },
  { name: "multiplier_cost", re: /\b\d+\s*(x|×|times)\s+(the\s+)?(cost|price)/i },
];

export type PriceHit = { turn: number; pattern: string; excerpt: string };

export function findPriceFigures(turns: { role: string; text: string }[]): PriceHit[] {
  const hits: PriceHit[] = [];
  turns.forEach((t, i) => {
    if (t.role !== "agent") return;
    for (const p of PATTERNS) {
      const m = t.text.match(p.re);
      if (m) hits.push({ turn: i, pattern: p.name, excerpt: t.text.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 40) });
    }
  });
  return hits;
}
