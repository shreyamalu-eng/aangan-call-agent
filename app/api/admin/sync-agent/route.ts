import { NextResponse } from "next/server";
import { cronOk, isAdmin } from "@/lib/auth";
import { syncAgent } from "@/lib/syncAgent";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Called by the post-deploy GitHub Action (Bearer CRON_SECRET) or from the dashboard Settings page. */
export async function POST(req: Request) {
  if (!cronOk(req) && !(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  try { return NextResponse.json(await syncAgent()); }
  catch (e) { return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 502 }); }
}
