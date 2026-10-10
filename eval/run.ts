/**
 * Replays T01–T20 through the same verdict + routing code the webhook uses.
 * Reports accuracy and every price figure found in AGENT/front-desk turns.
 *   npm run eval            (rules engine, offline)
 */
import { CASES } from "./transcripts";
import { INBOUND } from "./inbound";
import { parseTranscript } from "../lib/transcript";
import { ruleVerdict } from "../lib/verdict";
import { mergeTarget, previouslyDropped } from "../lib/history";
import { writeFileSync } from "node:fs";

type Row = { id: string; expected: string; got: string; ok: boolean; detail: string; priceHits: number };
const rows: Row[] = [];
let priceTotal = 0;

for (const c of CASES) {
  if (!c.transcript) {
    rows.push({ id: c.id, expected: c.expected, got: "answered by agent (no transcript to score)", ok: true, detail: c.note ?? "", priceHits: 0 });
    continue;
  }
  const turns = parseTranscript(c.transcript);
  let v = ruleVerdict(turns, { callDate: new Date(c.date) });
  let got: string = v.outcome;
  const extra: string[] = [];

  // T16 fixture: the Monday call that was never followed up (what our log would now hold).
  if (c.id === "T16") {
    const prior = [{ id: "monday", status: "new", created_at: "2026-09-15T15:00:00+05:30", last_call_ended_at: "2026-09-15T15:04:00+05:30", handed_off: false, claimed: false }];
    if (previouslyDropped(prior, new Date(c.date))) extra.push("history: previously dropped");
  }
  if (c.secondCall) {
    const first = v;
    const prior = [{ id: "call1", status: first.outcome, created_at: c.date, last_call_ended_at: new Date(new Date(c.date).getTime() + 72e3).toISOString(), handed_off: false, claimed: false }];
    const target = mergeTarget(prior, new Date(c.secondCall.date));
    const turns2 = parseTranscript(c.transcript + "\n" + c.secondCall.transcript);
    v = ruleVerdict(turns2, { callDate: new Date(c.secondCall.date) });
    got = v.outcome;
    extra.push(`call 1 = ${first.outcome}; call 2 ${target ? "merged into the same enquiry" : "NOT merged"}`);
  }

  const hits = v.priceHits.length;
  priceTotal += hits;
  let ok = got === c.expected;
  if (c.id === "T16") ok = ok && (v.priority === "previously_dropped");
  if (c.id === "T14") ok = ok && /both attending/.test(v.noteForDesigner);
  const fails = v.declineCriteria.length ? ` · failed: ${v.declineCriteria.join(", ")}` : "";
  rows.push({
    id: c.id, expected: c.expected + (c.note ? ` (${c.note})` : ""), got, ok,
    detail: `${v.fields.locality ?? "?"} · ${v.segment}${fails}${v.flags.length ? ` · flags: ${v.flags.join(", ")}` : ""}${v.priority !== "normal" ? ` · priority: ${v.priority}` : ""}${v.noteForDesigner !== "none" ? ` · note: ${v.noteForDesigner}` : ""}${extra.length ? ` · ${extra.join("; ")}` : ""}${v.followUpAt ? ` · follow-up ${v.followUpAt}` : ""}`,
    priceHits: hits,
  });
  if (hits) for (const h of v.priceHits) console.log(`  price figure in ${c.id} (front desk, turn ${h.turn}): …${h.excerpt}…`);
}

// WhatsApp threads and web forms go through the same verdict (channel-agnostic pipeline).
const inRows: Row[] = INBOUND.map((c) => {
  const v = ruleVerdict(parseTranscript(c.transcript), { callDate: new Date(c.date) });
  const fails = v.declineCriteria.length ? ` · failed: ${v.declineCriteria.join(", ")}` : "";
  priceTotal += v.priceHits.length;
  return { id: c.id, expected: c.expected + (c.note ? ` (${c.note})` : ""), got: v.outcome, ok: v.outcome === c.expected,
    detail: `${c.channel} · ${v.fields.locality ?? "?"}${fails}${v.flags.length ? ` · flags: ${v.flags.join(", ")}` : ""}${v.followUpAt ? ` · follow-up ${v.followUpAt}` : ""}`, priceHits: v.priceHits.length };
});

const scored = rows.filter((r) => !r.got.startsWith("answered"));
const correct = scored.filter((r) => r.ok).length;
const md = [
  `# Eval: T01–T20 (rules engine)`,
  ``,
  `Accuracy: **${correct}/${scored.length}** scored cases (T08 is a missed call with no transcript).`,
  `Price figures in front-desk turns of the raw transcripts: **${priceTotal}** (the Vaani agent's target is 0; see note).`,
  ``,
  `| ID | Expected | Got | ✓ | Detail | ₹ hits |`,
  `|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.id} | ${r.expected} | ${r.got} | ${r.ok ? "✅" : "❌"} | ${r.detail.replace(/\|/g, "/")} | ${r.priceHits} |`),
  ``,
  `## WhatsApp and web form (same verdict code)`,
  ``,
  `Accuracy: **${inRows.filter((r) => r.ok).length}/${inRows.length}**`,
  ``,
  `| ID | Expected | Got | ✓ | Detail | ₹ hits |`,
  `|---|---|---|---|---|---|`,
  ...inRows.map((r) => `| ${r.id} | ${r.expected} | ${r.got} | ${r.ok ? "✅" : "❌"} | ${r.detail.replace(/\|/g, "/")} | ${r.priceHits} |`),
].join("\n");
writeFileSync(new URL("./report.md", import.meta.url), md + "\n");
console.log(md);
if (correct !== scored.length || inRows.some((r) => !r.ok)) process.exitCode = 1;
