import { NextResponse } from "next/server";
import { pullRecentCalls } from "@/lib/pullCalls";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Called by the Calls page after a call ends, so it shows up without waiting for the 5-minute job. */
export async function POST() {
  try { return NextResponse.json(await pullRecentCalls(10)); }
  catch (e) { return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 502 }); }
}
