/** npm run db:migrate — applies db/*.sql and seeds localities from lib/localities.ts (one source). */
import { readFileSync, readdirSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { LOCALITIES } from "../lib/localities";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL (Neon pooled connection string)"); process.exit(1); }
const sql = neon(url);
for (const f of readdirSync(new URL("../db/", import.meta.url)).filter((x) => x.endsWith(".sql")).sort()) {
  const text = readFileSync(new URL(`../db/${f}`, import.meta.url), "utf8");
  const statements = text.split(/;\s*\n/).map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean);
  for (const s of statements) await sql.query(s);
  console.log(`applied ${f} (${statements.length} statements)`);
}
for (const l of LOCALITIES) {
  await sql.query("insert into localities (name, aliases, zone, status) values ($1,$2,$3,$4) on conflict (name) do update set aliases = excluded.aliases, zone = excluded.zone, status = excluded.status", [l.name, l.aliases, l.zone, l.status]);
}
console.log(`seeded ${LOCALITIES.length} localities`);
