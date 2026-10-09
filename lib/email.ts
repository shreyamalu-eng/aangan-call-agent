/** Resend. Without a verified domain, Resend only delivers to the account owner's address. */
import { fetchJson } from "./http";

export async function sendEmail(p: { to: string | string[]; subject: string; html: string; text?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const to = (Array.isArray(p.to) ? p.to : [p.to]).filter(Boolean);
  if (!to.length) return null;
  const r = await fetchJson<any>("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.RESEND_FROM || "Aangan Studio <onboarding@resend.dev>", to, subject: p.subject, html: p.html, text: p.text }),
  });
  return (r?.id as string) ?? null;
}

export async function ping() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  try {
    await fetchJson("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
  } catch (e) {
    // A sending-only key can't list domains but still sends: that's healthy.
    if (!/restricted|401/.test(String(e))) throw e;
  }
  return true;
}
