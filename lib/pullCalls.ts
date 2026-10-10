import { one } from "./db";
import { callHistory, callDetails } from "./vaani";
import { processCall } from "./pipeline";

/**
 * Pulls finished Vaani calls we never got a post-processing webhook for and runs them through the
 * pipeline. Used by the 5-minute tick and right after a call started from the dashboard ends.
 */
export async function pullRecentCalls(limit = 25) {
  const recent = await callHistory(1, limit);
  const agentId = process.env.VAANI_AGENT_ID;
  let pulled = 0, waiting = 0;
  for (const c of recent) {
    if (agentId && c.agent_id && c.agent_id !== agentId) continue;
    const done = await one("select 1 from calls where vaani_call_id = $1 and state = 'processed'", [c.call_id]);
    if (done) continue;
    if (!c.End_time) { waiting++; continue; }
    const d = await callDetails(c.call_id);
    const transcript = d?.transcription ?? d?.transcript;
    if (!transcript || /not available/i.test(String(transcript))) { waiting++; continue; }
    await processCall({ call_id: c.call_id, transcript, entities: d.entity ?? d.entities, summary: d.summary, started_at: c.Start_time ? `${c.Start_time}Z` : undefined, ended_at: c.End_time ? `${c.End_time}Z` : undefined, call_duration: c.Start_time && c.End_time ? (new Date(c.End_time).getTime() - new Date(c.Start_time).getTime()) / 1000 : undefined, phone_number: c.call_type === "Inbound" ? c.from_number : null });
    pulled++;
  }
  return { seen: recent.length, pulled, waiting };
}
