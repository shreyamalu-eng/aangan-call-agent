/**
 * Optional second opinion from a cheap, fast model. It only fills criteria the rules left
 * "unclear", never overrides a hard rule (area list, out-of-scope type, complaint), and never
 * sees a phone number or email (the transcript is redacted first).
 */
import { fetchJson } from "./http";
import type { Criteria } from "./verdict";

const RUBRIC = `You check an interior-design enquiry call against five pass/fail criteria. Return JSON only:
{"real_project":{"result":"pass|fail|unclear","evidence":""},"service_area":{...},"timeline":{...},"budget":{"result":"pass|fail|not_mentioned","evidence":""},"decision_maker":{...}}
1 real_project: design AND execution, at least a full room (fail: advice/ideas only, self-execution, decor only).
2 service_area: Pune city or PCMC (fail: Talegaon, Lonavala, Nashik, Mumbai, other cities).
3 timeline: fail only if completion is needed in under 6 weeks from the call date.
4 budget: fail only if the CALLER volunteered an amount clearly below the scope; otherwise not_mentioned or pass.
5 decision_maker: pass if the caller decides or the decision-makers will attend; unclear otherwise.
Evidence is a short quote from the caller.`;

export type LlmResult = { criteria: Partial<Criteria>; tokensIn: number; tokensOut: number; model: string } | null;

export async function llmCriteria(redactedTranscript: string, callDateIso: string): Promise<LlmResult> {
  const prompt = `${RUBRIC}\n\nCall date: ${callDateIso}\n\nTranscript:\n${redactedTranscript.slice(0, 12000)}`;
  try {
    if (process.env.GEMINI_API_KEY) {
      const model = process.env.VERDICT_MODEL || "gemini-2.5-flash";
      const r = await fetchJson<any>(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, timeoutMs: 20000,
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
      });
      const text = r?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      return { criteria: JSON.parse(text), tokensIn: r?.usageMetadata?.promptTokenCount ?? 0, tokensOut: r?.usageMetadata?.candidatesTokenCount ?? 0, model };
    }
    if (process.env.ANTHROPIC_API_KEY) {
      const model = process.env.VERDICT_MODEL || "claude-haiku-4-5";
      const r = await fetchJson<any>("https://api.anthropic.com/v1/messages", {
        method: "POST", timeoutMs: 20000,
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 600, temperature: 0, messages: [{ role: "user", content: prompt }] }),
      });
      const text: string = r?.content?.[0]?.text ?? "{}";
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      return { criteria: JSON.parse(json), tokensIn: r?.usage?.input_tokens ?? 0, tokensOut: r?.usage?.output_tokens ?? 0, model };
    }
  } catch (e) {
    console.error("[verdict-llm] failed, using rules only:", String(e).slice(0, 200));
  }
  return null;
}
