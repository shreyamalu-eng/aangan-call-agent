import { AGENT_DISPLAY_NAME, vaaniConfig } from "@/agent/blocks";
import { createAgent, listAgents, patchAgent } from "./vaani";
import { setWebhook } from "./telegram";
import { appUrl } from "./env";

type Section = "persona" | "training" | "experience" | "analysis";

/**
 * Creates the Aangan agent in Vaani if it doesn't exist, then PATCHes every section from
 * agent/blocks.ts. Runs after each deploy and nightly (date line). Idempotent.
 */
export async function syncAgent({ sections = ["persona", "training", "experience", "analysis"] as Section[] } = {}) {
  const cfg = vaaniConfig(new Date());
  let agentId = process.env.VAANI_AGENT_ID || null;
  let created = false;
  if (!agentId) {
    const found = (await listAgents(AGENT_DISPLAY_NAME)).find((a) => a.display_name === AGENT_DISPLAY_NAME);
    agentId = found?.id ?? null;
  }
  if (!agentId) {
    const r = await createAgent(AGENT_DISPLAY_NAME, { persona: cfg.persona, training: cfg.training, analysis: cfg.analysis, experience: cfg.experience });
    agentId = r.agent_id;
    created = true;
  }
  const results: Record<string, string> = {};
  for (const s of sections) {
    try { await patchAgent(agentId, s, (cfg as any)[s]); results[s] = "ok"; }
    catch (e) { results[s] = String(e).slice(0, 200); }
  }
  let telegram = "skipped";
  if (process.env.TELEGRAM_BOT_TOKEN && appUrl()) {
    try { await setWebhook(`${appUrl()}/api/telegram/webhook`); telegram = "webhook set"; } catch (e) { telegram = String(e).slice(0, 120); }
  }
  return { agentId, created, sections: results, telegram, note: created ? "Add VAANI_AGENT_ID to Vercel env so later syncs skip the lookup." : undefined };
}
