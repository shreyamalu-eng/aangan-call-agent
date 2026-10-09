import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";
const EDITABLE = new Set(["avg_project_value_inr", "vaani_rate_inr_per_min", "llm_rate_inr_per_1k_tokens", "low_budget_lakh_per_room", "sla_l1_minutes", "sla_l2_minutes", "sla_breach_minutes"]);

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const f = await req.formData();
  for (const [k, v] of f.entries()) {
    if (!EDITABLE.has(k)) continue;
    const n = Number(String(v).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n < 0) continue;
    await q("insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value", [k, String(n)]);
  }
  return NextResponse.redirect(new URL("/settings?saved=1", req.url), 303);
}
