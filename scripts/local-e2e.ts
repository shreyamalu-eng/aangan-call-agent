/**
 * Local end-to-end check with an embedded Postgres (no network): migrate, replay transcripts
 * through the real pipeline, and print what landed in each table.
 *   TEST_PGLITE=1 TEST_PGLITE_DIR=.pglite npx tsx scripts/local-e2e.ts
 */
import { readFileSync } from "node:fs";
import { exec, q } from "../lib/db";
import { processCall } from "../lib/pipeline";
import { CASES } from "../eval/transcripts";
import { LOCALITIES } from "../lib/localities";

await exec(readFileSync(new URL("../db/001_init.sql", import.meta.url), "utf8"));
for (const l of LOCALITIES) await q("insert into localities (name, aliases, zone, status) values ($1,$2,$3,$4) on conflict (name) do nothing", [l.name, l.aliases, l.zone, l.status]);

const base = Date.now() - 3 * 36e5;
let i = 0;
for (const c of CASES.filter((x) => x.transcript)) {
  const t0 = new Date(base + i++ * 6 * 60000);
  const len = c.secondCall ? 72 : 240; // T17's first call dropped at 1:12
  const r: any = await processCall({ call_id: `local-${c.id}`, transcript: c.transcript, started_at: t0.toISOString(), ended_at: new Date(t0.getTime() + len * 1000).toISOString(), call_duration: len, entities: { callback_number: c.phone, caller_name: c.id === "T01" ? "Priya" : null }, summary: `Local replay of ${c.id}` });
  if (c.secondCall) {
    const t1 = new Date(t0.getTime() + 120000);
    const r2: any = await processCall({ call_id: `local-${c.id}-b`, transcript: c.secondCall.transcript, started_at: t1.toISOString(), ended_at: new Date(t1.getTime() + 270000).toISOString(), call_duration: 270, entities: { callback_number: c.phone } });
    console.log(c.id, "call 1:", r.outcome, "· call 2:", r2.outcome, r2.enquiryId === r.enquiryId ? "(merged ✓)" : "(NOT merged ✗)");
  } else console.log(c.id, r.outcome, r.errors?.length ? `· provider steps skipped: ${r.errors.length}` : "");
}
// Idempotency: the same webhook delivered twice must not create a second row.
const dup: any = await processCall({ call_id: "local-T01", transcript: CASES[0].transcript });
console.log("duplicate delivery:", dup.status);
console.log(await q("select status, count(*)::int n from enquiries group by 1 order by 1"));
console.log(await q("select count(*)::int calls, count(*) filter (where state='processed')::int processed from calls"));
console.log("people rows:", (await q("select count(*)::int n from people"))[0], "· transcripts with a raw phone:", (await q("select count(*)::int n from transcripts where turns::text ~ '[6-9][0-9]{9}'"))[0]);
