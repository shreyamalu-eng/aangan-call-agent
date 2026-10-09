import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";
/** Hides replayed test rows (never deletes them). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  await q("update enquiries set archived = true where is_test = true and archived = false");
  return NextResponse.redirect(new URL("/calls?archived=1", req.url), 303);
}
