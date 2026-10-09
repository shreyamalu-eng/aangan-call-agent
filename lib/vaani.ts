/**
 * Vaani client (docs.vaanivoice.ai). Auth: X-API-Key. Endpoints confirmed in the docs:
 *   POST /api/create-agent · GET /api/agents · PATCH /api/agent/{id}/{section}
 *   GET /api/call-history · GET /api/transcript/{call_id} · GET /api/stream/{call_id} · GET /api/call_details/…
 */
import crypto from "node:crypto";
import { fetchJson } from "./http";

const BASE = "https://api.vaanivoice.ai";
const key = () => {
  const k = process.env.VAANI_API_KEY;
  if (!k) throw new Error("VAANI_API_KEY is not set");
  return k;
};
const h = () => ({ "X-API-Key": key(), "Content-Type": "application/json" });

export async function listAgents(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const r = await fetchJson<any>(`${BASE}/api/agents${qs}`, { headers: h() });
  return (Array.isArray(r) ? r : r?.data ?? []) as { id: string; display_name?: string; agent_name?: string }[];
}

export async function createAgent(displayName: string, config: unknown) {
  return fetchJson<{ success: boolean; agent_id: string }>(`${BASE}/api/create-agent`, {
    method: "POST", headers: h(), body: JSON.stringify({ agent_display_name: displayName, config }),
  });
}

export async function patchAgent(agentId: string, section: "persona" | "training" | "experience" | "analysis" | "deployment", body: unknown) {
  return fetchJson(`${BASE}/api/agent/${agentId}/${section}`, { method: "PATCH", headers: h(), body: JSON.stringify(body), timeoutMs: 20000 });
}

export async function callHistory(page = 1, pageSize = 50) {
  const r = await fetchJson<any>(`${BASE}/api/call-history?page=${page}&page_size=${pageSize}`, { headers: h() });
  return (r?.data ?? []) as any[];
}

export async function callDetails(callId: string) {
  // Docs list both shapes; the client segment is resolved from the key.
  try {
    return await fetchJson<any>(`${BASE}/api/call_details/${encodeURIComponent(callId)}`, { headers: h() });
  } catch {
    const client = process.env.VAANI_CLIENT_NAME || "me";
    return fetchJson<any>(`${BASE}/api/call_details/${encodeURIComponent(client)}/${encodeURIComponent(callId)}`, { headers: h() });
  }
}

export async function transcript(callId: string) {
  return fetchJson<any>(`${BASE}/api/transcript/${encodeURIComponent(callId)}`, { headers: h() });
}

/** Streams the recording through our server so the API key never reaches the browser. */
export async function streamRecording(callId: string): Promise<Response> {
  return fetch(`${BASE}/api/stream/${encodeURIComponent(callId)}`, { headers: { "X-API-Key": key() } });
}

/** X-Vaani-Signature: sha256=HMAC_SHA256(secret, `${timestamp}.${rawBody}`), X-Vaani-Timestamp within 300s. */
export function verifySignature(rawBody: string, sigHeader: string | null, tsHeader: string | null): "ok" | "bad" | "unsigned" {
  const secret = process.env.VAANI_WEBHOOK_SECRET;
  if (!secret) return "unsigned";
  if (!sigHeader || !tsHeader) return "bad";
  const age = Math.abs(Date.now() / 1000 - Number(tsHeader));
  if (!Number.isFinite(age) || age > 300) return "bad";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(`${tsHeader}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sigHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? "ok" : "bad";
}
