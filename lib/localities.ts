/**
 * Service area, seeded from services.md. One source: the Vaani prompt, the `localities` table
 * and the post-call matcher all read this list.
 *
 * status: "in"  = named in services.md
 *         "confirm" = inside Pune/PCMC but not named in services.md (open question for Nikhil)
 *         "out" = named as not served, or another city
 */
export type Locality = { name: string; zone: "pune" | "pcmc" | "outside"; status: "in" | "out" | "confirm"; aliases: string[] };

export const LOCALITIES: Locality[] = [
  // Pune city (services.md)
  { name: "Kothrud", zone: "pune", status: "in", aliases: ["kothrud", "dahanukar colony", "karve nagar"] },
  { name: "Baner", zone: "pune", status: "in", aliases: ["baner", "balewadi", "baner pashan link"] },
  { name: "Aundh", zone: "pune", status: "in", aliases: ["aundh", "sunderban", "aundh gaon"] },
  { name: "Wakad", zone: "pune", status: "in", aliases: ["wakad"] },
  { name: "Koregaon Park", zone: "pune", status: "in", aliases: ["koregaon park", "kp", "koregoan park", "north main road"] },
  { name: "Kalyani Nagar", zone: "pune", status: "in", aliases: ["kalyani nagar", "kalyaninagar"] },
  { name: "Viman Nagar", zone: "pune", status: "in", aliases: ["viman nagar", "vimannagar", "viman nagar side"] },
  { name: "Hadapsar", zone: "pune", status: "in", aliases: ["hadapsar"] },
  { name: "Magarpatta", zone: "pune", status: "in", aliases: ["magarpatta", "magarpatta city", "cybercity", "cyber city"] },
  { name: "NIBM", zone: "pune", status: "in", aliases: ["nibm", "nibm road"] },
  { name: "Kondhwa", zone: "pune", status: "in", aliases: ["kondhwa"] },
  { name: "Undri", zone: "pune", status: "in", aliases: ["undri"] },
  { name: "Shivane", zone: "pune", status: "in", aliases: ["shivane"] },
  { name: "Warje", zone: "pune", status: "in", aliases: ["warje"] },
  { name: "Erandwane", zone: "pune", status: "in", aliases: ["erandwane", "erandwana"] },
  { name: "Deccan", zone: "pune", status: "in", aliases: ["deccan", "deccan gymkhana", "fc road", "jm road"] },
  // PCMC (services.md)
  { name: "Pimpri", zone: "pcmc", status: "in", aliases: ["pimpri"] },
  { name: "Chinchwad", zone: "pcmc", status: "in", aliases: ["chinchwad", "pimpri chinchwad"] },
  { name: "Pimple Saudagar", zone: "pcmc", status: "in", aliases: ["pimple saudagar", "pimple saudagaar"] },
  { name: "Pimple Nilakh", zone: "pcmc", status: "in", aliases: ["pimple nilakh"] },
  { name: "Ravet", zone: "pcmc", status: "in", aliases: ["ravet"] },
  { name: "Hinjewadi", zone: "pcmc", status: "in", aliases: ["hinjewadi", "hinjawadi", "hinjewadi phase 1", "hinjewadi phase 2", "hinjewadi phase 3"] },
  // Inside Pune/PCMC but not named in services.md -> designer/Nikhil to confirm (PLAN §6 Q6)
  { name: "Kharadi", zone: "pune", status: "confirm", aliases: ["kharadi", "eon it park"] },
  { name: "Nanded City", zone: "pune", status: "confirm", aliases: ["nanded city", "sinhagad road"] },
  { name: "Bavdhan", zone: "pune", status: "confirm", aliases: ["bavdhan"] },
  { name: "Pashan", zone: "pune", status: "confirm", aliases: ["pashan"] },
  { name: "Wagholi", zone: "pune", status: "confirm", aliases: ["wagholi"] },
  { name: "Moshi", zone: "pcmc", status: "confirm", aliases: ["moshi"] },
  { name: "Bhosari", zone: "pcmc", status: "confirm", aliases: ["bhosari"] },
  // Not served (services.md "We do not currently serve")
  { name: "Talegaon", zone: "outside", status: "out", aliases: ["talegaon", "talegaon dabhade"] },
  { name: "Lonavala", zone: "outside", status: "out", aliases: ["lonavala", "lonavla", "khandala"] },
  { name: "Nashik", zone: "outside", status: "out", aliases: ["nashik", "nasik"] },
  { name: "Mumbai", zone: "outside", status: "out", aliases: ["mumbai", "bombay", "thane", "navi mumbai"] },
  { name: "Bangalore", zone: "outside", status: "out", aliases: ["bangalore", "bengaluru"] },
  { name: "Satara", zone: "outside", status: "out", aliases: ["satara"] },
  { name: "Nagpur", zone: "outside", status: "out", aliases: ["nagpur"] },
];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Classic Levenshtein distance, used for spelling tolerance on short place names. */
export function lev(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export type AreaMatch = { status: "in" | "out" | "confirm" | "unclear"; locality: string | null; matchedText: string | null; fuzzy: boolean };

/**
 * Finds the first locality mentioned in free text. Exact alias match first (longest alias wins),
 * then a spelling-tolerant pass on 1–3 word windows (distance ≤ 1 for short names, ≤ 2 for long).
 */
export function matchArea(text: string | null | undefined): AreaMatch {
  if (!text) return { status: "unclear", locality: null, matchedText: null, fuzzy: false };
  const t = ` ${norm(text)} `;
  const aliases = LOCALITIES.flatMap((l) => l.aliases.map((a) => ({ l, a: norm(a) }))).sort((x, y) => y.a.length - x.a.length);
  // Score each sentence that names a place: the caller's own site ("we have a 3BHK in Kothrud")
  // beats a place mentioned about someone else ("she had her flat done in Aundh").
  const sentences = text.split(/(?<=[.?!])\s+|\n/);
  let best: { l: Locality; a: string; score: number; order: number } | null = null;
  sentences.forEach((sent, order) => {
    const st = ` ${norm(sent)} `;
    for (const { l, a } of aliases) {
      if (!st.includes(` ${a} `)) continue;
      let score = 0;
      if (/(we have|i have|my |our |i'?m in|i am in|property|site|planning to open|located|we'?re in|from )/i.test(sent)) score += 2;
      if (/\b(she|he|her|his|friend|their)\b/i.test(sent)) score -= 2;
      if (/location\s*:/i.test(sent)) score += 4; // web-form "Location:" field is the site
      if (/(find us|found us|referred|worked with|recommend|asked me to)/i.test(sent)) score -= 2;
      if (!best || score > best.score) best = { l, a, score, order };
      break;
    }
  });
  if (best) {
    const b = best as { l: Locality; a: string };
    return { status: b.l.status, locality: b.l.name, matchedText: b.a, fuzzy: false };
  }
  void t;

  const words = norm(text).split(" ").filter(Boolean);
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const w = words.slice(i, i + n).join(" ");
      if (w.length < 4) continue;
      // Only treat a near-miss as a place when it follows a place cue ("flat in kothrood"),
      // so ordinary words ("start", "banner") never turn into localities.
      if (!["in", "at", "near", "from", "around", "is", "of"].includes(words[i - 1] ?? "")) continue;
      for (const { l, a } of aliases) {
        if (a.split(" ").length !== n) continue;
        const max = a.length >= 6 ? 2 : 1;
        if (Math.abs(a.length - w.length) <= max && lev(a, w) <= max) {
          return { status: l.status, locality: l.name, matchedText: w, fuzzy: true };
        }
      }
    }
  }
  if (/\bpune\b|\bpcmc\b/.test(t)) return { status: "unclear", locality: "Pune (area not named)", matchedText: "pune", fuzzy: false };
  return { status: "unclear", locality: null, matchedText: null, fuzzy: false };
}

/** Text block injected into the Vaani prompt so the in-call check matches the post-call check. */
export function localityPromptBlock(): string {
  const by = (s: Locality["status"]) => LOCALITIES.filter((l) => l.status === s).map((l) => l.name).join(", ");
  return [
    `IN AREA (Pune city and PCMC): ${by("in")}, and adjoining areas.`,
    `INSIDE PUNE/PCMC BUT NOT LISTED — do not decline, say a designer will confirm: ${by("confirm")}.`,
    `NOT SERVED — decline politely: ${by("out")}, and any other city.`,
    `Callers mispronounce or misspell places (Hinjawadi/Hinjewadi, Pimpri-Chinchwad/PCMC). If unsure, ask once: "Is that within Pune city or PCMC?"`,
  ].join("\n");
}
