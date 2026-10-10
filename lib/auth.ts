import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "aangan_admin";
const token = () => crypto.createHash("sha256").update(`aangan:${process.env.DASHBOARD_PASSWORD || ""}`).digest("hex");

/**
 * Staff actions (settings, replay, outcomes). With no DASHBOARD_PASSWORD set, the dashboard is
 * open to everyone: no sign-in needed.
 */
export async function isAdmin() {
  if (!process.env.DASHBOARD_PASSWORD) return true;
  const c = (await cookies()).get(COOKIE)?.value;
  return Boolean(c && c.length === token().length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(token())));
}
/** Full names and phone numbers: only after signing in with a password. Without one, they stay masked. */
export async function canSeePii() {
  if (!process.env.DASHBOARD_PASSWORD) return false;
  return isAdmin();
}

export async function login(password: string) {
  if (!process.env.DASHBOARD_PASSWORD || password !== process.env.DASHBOARD_PASSWORD) return false;
  (await cookies()).set(COOKIE, token(), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 14 });
  return true;
}
export async function logout() { (await cookies()).delete(COOKIE); }

/** Cron and admin endpoints: Authorization: Bearer $CRON_SECRET (Vercel cron sends this header). */
export function cronOk(req: Request) {
  const s = process.env.CRON_SECRET;
  if (!s) return false;
  const h = req.headers.get("authorization") || "";
  const url = new URL(req.url);
  return h === `Bearer ${s}` || url.searchParams.get("secret") === s;
}
