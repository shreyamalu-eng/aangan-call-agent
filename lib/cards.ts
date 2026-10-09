import { esc } from "./telegram";
import type { Verdict } from "./verdict";
import { appUrl } from "./env";

const IST = (d: Date | string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(d));
const dur = (s: number | null | undefined) => (s ? `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s` : "—");
const tick = (r: string) => (r === "pass" ? "✅" : r === "fail" ? "❌" : r === "not_mentioned" ? "✅" : "❓");

/** The handoff note format from the brief. No phone number: designers get it on the lead page after claiming. */
export function handoffCard(p: { v: Verdict; firstName: string | null; startedAt: Date | string; durationS: number | null; enquiryId: string; claimedBy?: string | null; passes?: { name: string; reason: string }[]; escalation?: number }) {
  const { v } = p;
  const badge = v.priority === "previously_dropped" ? "⚠️ PRIORITY · PREVIOUSLY DROPPED" : v.flags.includes("callback_after_drop") ? "🔁 QUALIFIED LEAD (merged)" : "🏠 QUALIFIED LEAD";
  const c = v.criteria;
  const lines = [
    `<b>${badge}</b> · Phone · ${esc(IST(p.startedAt))} · ${dur(p.durationS)}`,
    `<b>${esc(p.firstName ?? "Caller")}</b> · ${esc(v.fields.locality ?? "area?")} · ${esc([v.fields.property, v.fields.size].filter(Boolean).join(", ") || "size?")}`,
    `<b>Scope:</b> ${esc(v.fields.scope ?? "—")}`,
    `<b>Timeline:</b> ${esc(v.fields.timeline ?? "not given")}`,
    `<b>Budget:</b> ${c.budget.result === "not_mentioned" ? "not mentioned" : esc(c.budget.evidence)}`,
    `<b>Decision:</b> ${esc(v.fields.decision ?? "—")}`,
    `<b>Source:</b> ${esc(v.fields.source ?? "—")}`,
    `<b>Criteria:</b> ${tick(c.real_project.result)} Real project ${tick(c.service_area.result)} Area ${tick(c.timeline.result)} Timeline ${tick(c.budget.result)} Budget${c.budget.result === "not_mentioned" ? " (n/a)" : ""} ${tick(c.decision_maker.result)} Decision-maker`,
  ];
  if (v.fields.likes || v.fields.dislikes) lines.push(`<b>Loves:</b> ${esc(v.fields.likes ?? "—")} · <b>Avoid:</b> ${esc(v.fields.dislikes ?? "—")}`);
  if (v.fitReasons.length) lines.push(`<b>Good fit because:</b> ${esc(v.fitReasons.slice(0, 3).join(" "))}`);
  if (v.watchOuts.length) lines.push(`<b>Watch for:</b> ${esc(v.watchOuts.slice(0, 3).join(" "))}`);
  lines.push(`<b>Notes for designer:</b> ${esc(v.noteForDesigner)}`);
  lines.push(`<b>Consultation requested:</b> ${esc(v.fields.preferredSlots ?? "times not given — call to agree")}`);
  lines.push(`<a href="${appUrl()}/calls/${p.enquiryId}">Transcript → dashboard</a>`);
  if (p.passes?.length) lines.push(`Passed by: ${esc(p.passes.map((x) => `${x.name} (${x.reason})`).join(", "))}`);
  if (p.escalation === 1) lines.push("⏱ 15 min unclaimed · front desk lead alerted");
  if (p.escalation === 2) lines.push("⏱ 30 min unclaimed · Nikhil alerted");
  if (p.escalation === 3) lines.push("🔴 Past 60 min");
  if (p.claimedBy) lines.push(`✅ <b>Claimed by ${esc(p.claimedBy)}</b>`);
  return lines.join("\n");
}

export const claimButtons = (handoffId: string) => [[{ text: "Claim", callback_data: `claim:${handoffId}` }, { text: "Pass", callback_data: `pass:${handoffId}` }]];
export const passReasonButtons = (handoffId: string) => [[
  { text: "Too busy", callback_data: `passr:${handoffId}:busy` },
  { text: "Not my speciality", callback_data: `passr:${handoffId}:speciality` },
  { text: "Location", callback_data: `passr:${handoffId}:location` },
]];

export const slotLabel = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
