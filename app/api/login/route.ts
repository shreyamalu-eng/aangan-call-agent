import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const f = await req.formData();
  const ok = await login(String(f.get("password") ?? ""));
  return NextResponse.redirect(new URL(ok ? "/" : "/login?error=1", req.url), 303);
}
