import { NextResponse } from "next/server";
import { runHealth } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await runHealth({ deep: false });
  return NextResponse.json(r, { status: r.ok ? 200 : 503 });
}
