import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { q, one } from "@/lib/db";
import * as hs from "@/lib/hubspot";

export const runtime = "nodejs";
const TO_HS: Record<string, Parameters<typeof hs.moveDeal>[1]> = { consultation_booked: "consultation_booked", consultation_done: "consultation_done", proposal: "proposal", signed: "won", lost: "lost" };

/** Designers/Nikhil mark the funnel stage; it updates Neon and the HubSpot deal together. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in to update outcomes" }, { status: 401 });
  const f = await req.formData();
  const enquiryId = String(f.get("enquiryId"));
  const stage = String(f.get("stage"));
  const value = f.get("value") ? Number(String(f.get("value")).replace(/[^\d.]/g, "")) : null;
  if (!TO_HS[stage]) return NextResponse.json({ error: "unknown stage" }, { status: 400 });
  await q("insert into outcomes (enquiry_id, stage, value_inr, set_by) values ($1,$2,$3,'dashboard')", [enquiryId, stage, value]);
  const h = await one<{ hubspot_deal_id: string | null }>("select hubspot_deal_id from handoffs where enquiry_id = $1", [enquiryId]);
  if (h?.hubspot_deal_id) { try { await hs.moveDeal(h.hubspot_deal_id, TO_HS[stage], value ? { amount: String(value) } : {}); } catch (e) { console.error(e); } }
  return NextResponse.redirect(new URL(`/calls/${enquiryId}?saved=1`, req.url), 303);
}
