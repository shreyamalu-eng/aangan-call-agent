/** Central list of env vars, so /api/health can report what is configured without exposing values. */
export const ENV_KEYS = {
  core: ["DATABASE_URL", "CRON_SECRET", "APP_URL"],
  vaani: ["VAANI_API_KEY", "VAANI_AGENT_ID", "VAANI_WEBHOOK_SECRET"],
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_DESIGNERS_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_ALERT_CHAT_ID"],
  hubspot: ["HUBSPOT_TOKEN", "HUBSPOT_PIPELINE_ID"],
  calcom: ["CALCOM_API_KEY", "CALCOM_EVENT_TYPE_ID"],
  resend: ["RESEND_API_KEY", "RESEND_FROM", "TEAM_EMAIL", "FOUNDER_EMAIL"],
  ai: ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "VERDICT_MODEL"],
  dashboard: ["DASHBOARD_PASSWORD"],
} as const;

/** Settings the app works without. Shown as "optional" (not failing) on /health, with what happens instead. */
export const OPTIONAL: Record<string, string> = {
  VAANI_WEBHOOK_SECRET: "Only if Vaani gives you a signing secret. Webhooks still work without it.",
  TELEGRAM_ALERT_CHAT_ID: "Alerts go to the designers' group instead.",
  HUBSPOT_PIPELINE_ID: "Uses HubSpot's built-in Sales Pipeline.",
  CALCOM_EVENT_TYPE_ID: "Uses CALCOM_EVENT_SLUG / your first event type.",
  RESEND_FROM: "Sends from Resend's test address (reaches your own inbox only).",
  GEMINI_API_KEY: "Optional second opinion. The rules decide every verdict without it.",
  ANTHROPIC_API_KEY: "Optional second opinion. The rules decide every verdict without it.",
  VERDICT_MODEL: "Only needed with a model key.",
  DASHBOARD_PASSWORD: "Off on purpose: the dashboard is open and phone numbers stay masked.",
};

export function has(name: string) {
  return Boolean(process.env[name] && process.env[name]!.trim());
}

export function envStatus() {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [group, keys] of Object.entries(ENV_KEYS)) {
    out[group] = Object.fromEntries(keys.map((k) => [k, has(k)]));
  }
  return out;
}

export const appUrl = () => (process.env.APP_URL || "").replace(/\/$/, "");
