import { q, one } from "./db";
import { envStatus, has } from "./env";
import * as hs from "./hubspot";
import * as cal from "./calcom";
import * as mail from "./email";
import { listAgents } from "./vaani";
import { fetchJson } from "./http";

type Check = { ok: boolean; ms: number; detail?: string };
async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const t = Date.now();
  try { await fn(); return { ok: true, ms: Date.now() - t }; } catch (e) { return { ok: false, ms: Date.now() - t, detail: String(e).slice(0, 200) }; }
}

/** deep=true also pings every provider (used by the 5-minute job, not by public page loads). */
export async function runHealth({ deep }: { deep: boolean }) {
  const checks: Record<string, Check> = { neon: await timed(() => one("select 1 as ok")) };
  if (deep) {
    if (has("VAANI_API_KEY")) checks.vaani = await timed(() => listAgents());
    if (has("HUBSPOT_TOKEN")) checks.hubspot = await timed(() => hs.ping());
    if (has("CALCOM_API_KEY")) checks.calcom = await timed(() => cal.ping());
    if (has("RESEND_API_KEY")) checks.resend = await timed(() => mail.ping());
    if (has("TELEGRAM_BOT_TOKEN")) checks.telegram = await timed(() => fetchJson(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`));
  }
  let lastCall: string | null = null;
  try { lastCall = (await one<{ t: string }>("select max(created_at) as t from calls"))?.t ?? null; } catch { /* db down */ }
  const ok = Object.values(checks).every((c) => c.ok);
  if (deep) { try { await q("insert into health_checks (results, ok) values ($1,$2)", [JSON.stringify(checks), ok]); } catch { /* db down */ } }
  return { ok, checks, env: envStatus(), lastCall, at: new Date().toISOString() };
}
