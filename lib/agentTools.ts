/** Shared helpers for the endpoints the Vaani agent calls during a call (custom tools). */
import { NextResponse } from "next/server";

/** Optional shared secret: set AGENT_TOOL_SECRET and send it from Vaani as header X-Tool-Secret. */
export function toolAuthOk(req: Request) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) return true;
  return req.headers.get("x-tool-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Vaani's exact request shape isn't documented, so accept query params, a flat JSON body, or one nested under parameters/arguments/args. */
export async function toolParams(req: Request): Promise<Record<string, any>> {
  const out: Record<string, any> = Object.fromEntries(new URL(req.url).searchParams);
  if (req.method !== "GET") {
    let body: any = null;
    const text = await req.text();
    try { body = text ? JSON.parse(text) : null; } catch { body = Object.fromEntries(new URLSearchParams(text)); }
    if (body && typeof body === "object") {
      for (const k of ["parameters", "arguments", "args", "data"]) {
        let v = body[k];
        if (typeof v === "string") { try { v = JSON.parse(v); } catch { /* not JSON */ } }
        if (v && typeof v === "object") Object.assign(out, v);
      }
      for (const [k, v] of Object.entries(body)) if (!(k in out) && (typeof v !== "object" || v === null)) out[k] = v;
    }
  }
  return out;
}

/** Tools always answer 200 with a sentence the agent can say, so a failure never leaves the caller in silence. */
export const say = (message: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: extra.ok ?? true, message, ...extra });

export const ist = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
