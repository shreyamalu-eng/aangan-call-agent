export type Turn = { role: "agent" | "caller"; text: string };

const AGENT_LABELS = /^(agent|assistant|bot|ai|vaani|front desk|frontdesk|receptionist)\s*:/i;
const CALLER_LABELS = /^(user|caller|customer|human|client)\s*:/i;

/** Accepts Vaani's "AGENT: … / USER: …" string, an array of {role,content}, or our own Turn[]. */
export function parseTranscript(raw: unknown): Turn[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((t: any) => {
        const role = String(t.role ?? t.speaker ?? t.from ?? "").toLowerCase();
        const text = String(t.text ?? t.content ?? t.message ?? "").trim();
        const isAgent = /agent|assistant|bot|ai|system/.test(role);
        return { role: isAgent ? "agent" : "caller", text } as Turn;
      })
      .filter((t) => t.text);
  }
  if (typeof raw !== "string") return [];
  const turns: Turn[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    if (AGENT_LABELS.test(l)) turns.push({ role: "agent", text: l.replace(AGENT_LABELS, "").trim() });
    else if (CALLER_LABELS.test(l)) turns.push({ role: "caller", text: l.replace(CALLER_LABELS, "").trim() });
    else if (turns.length) turns[turns.length - 1].text += " " + l;
  }
  return turns;
}

export const callerText = (turns: Turn[]) => turns.filter((t) => t.role === "caller").map((t) => t.text).join("\n");
export const agentText = (turns: Turn[]) => turns.filter((t) => t.role === "agent").map((t) => t.text).join("\n");
export const allText = (turns: Turn[]) => turns.map((t) => t.text).join("\n");
