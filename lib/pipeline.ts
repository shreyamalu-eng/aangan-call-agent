/**
 * After-call pipeline: one function both the webhook and the 5-minute poll call.
 * Order: log the call first (every call gets a row), then verdict, then route. Each provider step
 * is isolated, so a HubSpot or Telegram outage never loses the call or the verdict.
 */
import crypto from "node:crypto";
import { q, one, setting } from "./db";
import { parseTranscript, allText } from "./transcript";
import { ruleVerdict, type Verdict } from "./verdict";
import { llmCriteria } from "./llm";
import { normalizeEmail, normalizePhone, redact, maskPhone } from "./normalize";
import { mergeTarget, previouslyDropped, type PriorEnquiry } from "./history";
import * as tg from "./telegram";
import * as hs from "./hubspot";
import { sendEmail } from "./email";
import { handoffCard, claimButtons } from "./cards";
import { appUrl } from "./env";

export type VaaniCall = {
  call_id: string; room_name?: string; call_duration?: number; end_reason?: string; summary?: string;
  entities?: Record<string, any>; dispositions?: Record<string, any>; recording_url?: string; transcript?: unknown;
  started_at?: string; ended_at?: string; phone_number?: string | null;
};

export const phoneHash = (e164: string) => crypto.createHash("sha256").update(`${process.env.PHONE_PEPPER || "aangan"}:${e164}`).digest("hex");

const istHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(d));
const flat = (e: Record<string, any> = {}) => {
  // Vaani may return { name: value } or { name: { value } }.
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(e)) out[k] = v && typeof v === "object" && "value" in v ? v.value : v;
  for (const k of Object.keys(out)) if (out[k] === "null" || out[k] === "N/A" || out[k] === "") out[k] = null;
  return out;
};

/** Vaani reports call_duration in seconds on call_ended and (apparently) milliseconds on post-processing. */
export function durationSeconds(v: number | null | undefined) {
  if (!v) return null;
  return v > 4000 ? Math.round(v / 1000) : Math.round(v);
}

export async function processCall(c: VaaniCall, opts: { isTest?: boolean } = {}) {
  const existing = await one<{ id: string; state: string }>("select id, state from calls where vaani_call_id = $1", [c.call_id]);
  if (existing?.state === "processed") return { status: "duplicate", callId: existing.id };

  const turns = parseTranscript(c.transcript);
  const ent = flat(c.entities);
  const durationS = durationSeconds(c.call_duration);
  const endedAt = c.ended_at ? new Date(c.ended_at) : new Date();
  const startedAt = c.started_at ? new Date(c.started_at) : new Date(endedAt.getTime() - (durationS ?? 0) * 1000);
  const inHours = istHour(startedAt) >= 10 && istHour(startedAt) < 19;

  // 1. Log the call row first.
  const call = existing ?? (await one<{ id: string }>(
    `insert into calls (vaani_call_id, room_name, started_at, ended_at, duration_s, answered_by, in_hours, end_reason, recording_url, state)
     values ($1,$2,$3,$4,$5,'agent',$6,$7,$8,'received')
     on conflict (vaani_call_id) do update set recording_url = coalesce(excluded.recording_url, calls.recording_url)
     returning id`,
    [c.call_id, c.room_name ?? null, startedAt, endedAt, durationS, inHours, c.end_reason ?? null, c.recording_url ?? null],
  ))!;

  try {
    // 2. PII goes to `people`; everything else only sees the hash/redacted text.
    const phone = normalizePhone(ent.callback_number) ?? normalizePhone(c.phone_number ?? null);
    const email = normalizeEmail(ent.email);
    const firstName = ent.caller_name ? String(ent.caller_name).split(/\s+/)[0] : null;
    let personId: string | null = null;
    if (phone) {
      const p = await one<{ id: string }>(
        `insert into people (full_name, phone_e164, phone_hash, email) values ($1,$2,$3,$4)
         on conflict (phone_hash) do update set full_name = coalesce(excluded.full_name, people.full_name), email = coalesce(excluded.email, people.email)
         returning id`, [ent.caller_name ?? null, phone, phoneHash(phone), email]);
      personId = p!.id;
    } else if (ent.caller_name || email) {
      personId = (await one<{ id: string }>("insert into people (full_name, email) values ($1,$2) returning id", [ent.caller_name ?? null, email]))!.id;
    }

    // 3. History: merge a call-back within 30 min (T17); flag an earlier dropped enquiry (T16).
    let prior: PriorEnquiry[] = [];
    if (personId) {
      prior = await q<PriorEnquiry>(
        `select e.id, e.status, e.created_at,
                (select max(ended_at) from calls where enquiry_id = e.id) as last_call_ended_at,
                exists(select 1 from handoffs h where h.enquiry_id = e.id and h.sent_at is not null) as handed_off,
                exists(select 1 from handoffs h where h.enquiry_id = e.id and h.claimed_at is not null) as claimed
         from enquiries e where e.person_id = $1 and e.merged_into is null and e.archived = false order by e.created_at desc limit 5`, [personId]);
    }
    const mergeInto = mergeTarget(prior, startedAt);
    const dropped = !mergeInto && previouslyDropped(prior, startedAt);
    const activeProject = personId ? await one("select 1 from active_projects where person_id = $1 and status = 'active'", [personId]) : null;

    // For a merged call, judge the conversation as a whole.
    let judgedTurns = turns;
    if (mergeInto) {
      const earlier = await q<{ turns: any }>(`select t.turns from transcripts t join calls k on k.id = t.call_id where k.enquiry_id = $1 order by k.started_at`, [mergeInto]);
      judgedTurns = [...earlier.flatMap((r) => r.turns), ...turns];
    }

    // 4. Verdict: rules first, model fills only what the rules left unclear.
    const perRoom = Number(await setting("low_budget_lakh_per_room", "2.5"));
    const v: Verdict = ruleVerdict(judgedTurns, { callDate: startedAt, lowBudgetLakhPerRoom: perRoom, entities: ent });
    let tokensIn = 0, tokensOut = 0;
    const needsHelp = Object.values(v.criteria).some((x) => x.result === "unclear");
    if (needsHelp && v.outcome !== "complaint") {
      const redacted = redact(judgedTurns.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n"));
      const llm = await llmCriteria(ent.caller_name ? redacted.split(ent.caller_name).join("[CALLER]") : redacted, startedAt.toISOString());
      if (llm) {
        tokensIn = llm.tokensIn; tokensOut = llm.tokensOut; v.engine = `rules+${llm.model}`;
        for (const k of Object.keys(v.criteria) as (keyof Verdict["criteria"])[]) {
          const r = llm.criteria[k];
          if (v.criteria[k].result === "unclear" && r && ["pass", "fail"].includes(r.result)) v.criteria[k] = { result: r.result, evidence: `${r.evidence} (model)` };
        }
      }
    }
    if (activeProject || ent.is_existing_client === "yes") { v.outcome = "complaint"; v.priority = "urgent"; }
    if (dropped && v.outcome !== "complaint") { v.priority = "previously_dropped"; if (!v.flags.includes("previously_dropped")) v.flags.push("previously_dropped"); }
    if (ent.wants_human === "yes") v.flags.push("wants_human");
    if (v.priceHits.length) v.flags.push("price_figure_spoken");

    // 5. Enquiry row (merged calls update the earlier one).
    const fields = [v.fields.source, v.segment, v.fields.locality, v.area.status, [v.fields.property, v.fields.size].filter(Boolean).join(", ") || null,
      v.fields.scope, v.fields.timeline, v.fields.decision, v.fields.likes, v.fields.dislikes, v.fields.preferredSlots,
      v.outcome, v.declineCriteria, v.priority, v.followUpAt, opts.isTest ?? false];
    let enquiryId: string;
    if (mergeInto) {
      await q(`update enquiries set source=$1, segment=$2, locality=$3, area_status=$4, size_text=$5, scope_text=$6, timeline_text=$7, decision_text=$8,
               likes=$9, dislikes=$10, preferred_slots=$11, status=$12, decline_criteria=$13, priority=$14, follow_up_at=$15, updated_at=now() where id=$16`, [...fields.slice(0, 15), mergeInto]);
      enquiryId = mergeInto;
    } else {
      enquiryId = (await one<{ id: string }>(
        `insert into enquiries (source, segment, locality, area_status, size_text, scope_text, timeline_text, decision_text, likes, dislikes, preferred_slots,
          status, decline_criteria, priority, follow_up_at, is_test, person_id, channel)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'phone') returning id`, [...fields, personId]))!.id;
    }
    await q("update calls set enquiry_id = $1 where id = $2", [enquiryId, call.id]);

    const redactedTurns = turns.map((t) => ({ ...t, text: ent.caller_name ? redact(t.text).split(String(ent.caller_name)).join("[CALLER]") : redact(t.text) }));
    await q(`insert into transcripts (call_id, turns, summary, entities, dispositions) values ($1,$2,$3,$4,$5)
             on conflict (call_id) do update set turns = excluded.turns, summary = excluded.summary, entities = excluded.entities, dispositions = excluded.dispositions`,
      [call.id, JSON.stringify(redactedTurns), c.summary ? redact(c.summary) : null, JSON.stringify({ ...ent, callback_number: phone ? maskPhone(phone) : null, email: email ? "[EMAIL]" : null }), JSON.stringify(c.dispositions ?? {})]);
    await q(`insert into verdicts (enquiry_id, call_id, engine, criteria, outcome, flags, note_for_designer, fit_reasons, watch_outs, price_figure_spoken, price_hits, tokens_in, tokens_out)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [enquiryId, call.id, v.engine, JSON.stringify(v.criteria), v.outcome, v.flags, v.noteForDesigner, v.fitReasons, v.watchOuts, v.priceHits.length > 0, JSON.stringify(v.priceHits), tokensIn || null, tokensOut || null]);

    // 6. Costs from actual usage × the editable rate (no rates hardcoded in code).
    const rate = Number(await setting("vaani_rate_inr_per_min", "5.5"));
    if (durationS) await q("insert into cost_events (call_id, provider, units, unit_type, amount_inr, basis) values ($1,'vaani',$2,'minutes',$3,'usage_x_rate')", [call.id, durationS / 60, (durationS / 60) * rate]);
    if (tokensIn || tokensOut) {
      const per1k = Number(await setting("llm_rate_inr_per_1k_tokens", "0.03"));
      await q("insert into cost_events (call_id, provider, units, unit_type, amount_inr, basis) values ($1,'llm',$2,'tokens',$3,'usage_x_rate')", [call.id, tokensIn + tokensOut, ((tokensIn + tokensOut) / 1000) * per1k]);
    }

    // 7. Route.
    const errors: string[] = [];
    const safe = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { errors.push(`${label}: ${String(e).slice(0, 200)}`); } };

    if (v.outcome === "qualified" || v.outcome === "hold_designer_confirm") {
      await safe("handoff", () => handoff({ enquiryId, v, firstName, phone, email, startedAt, durationS, summary: c.summary ?? null, hold: v.outcome === "hold_designer_confirm" }));
    }
    if (v.outcome === "complaint") {
      await q("insert into escalations (enquiry_id, reason) values ($1,'complaint')", [enquiryId]);
      await safe("page", () => tg.alert(`🛟 <b>EXISTING CLIENT — CALL BACK NOW</b>\n${tg.esc(v.fields.locality ?? "")} · ${tg.esc(c.summary ?? v.criteria.real_project.evidence)}\n${inHours ? "During hours" : "After hours: caller was promised a senior callback"}\n<a href="${appUrl()}/calls/${enquiryId}">Open in dashboard</a>`));
      await safe("page-email", () => sendEmail({ to: [process.env.FOUNDER_EMAIL || "", process.env.TEAM_EMAIL || ""], subject: "Existing client needs a senior callback", html: `<p>An existing client called and needs a senior callback.</p><p><a href="${appUrl()}/calls/${enquiryId}">Open the call</a></p>` }));
    }
    if (v.priority === "previously_dropped" && v.outcome === "qualified") {
      await safe("dropped-alert", () => tg.alert(`⚠️ <b>Previously dropped lead called back</b> — senior designer please take this one.\n<a href="${appUrl()}/calls/${enquiryId}">Open in dashboard</a>`));
    }

    await q("update calls set state='processed', error=$2 where id=$1", [call.id, errors.length ? errors.join(" | ") : null]);
    return { status: "processed", callId: call.id, enquiryId, outcome: v.outcome, errors };
  } catch (e) {
    await q("update calls set state='failed', error=$2 where id=$1", [call.id, String(e).slice(0, 500)]);
    await tg.alert(`🔧 Call processing failed for ${tg.esc(c.call_id)}: ${tg.esc(String(e).slice(0, 200))}`);
    throw e;
  }
}

async function handoff(p: { enquiryId: string; v: Verdict; firstName: string | null; phone: string | null; email: string | null; startedAt: Date; durationS: number | null; summary: string | null; hold: boolean }) {
  const row = (await one<{ id: string; sent_at: string | null; tg_message_id: number | null; hubspot_deal_id: string | null }>(
    `insert into handoffs (enquiry_id) values ($1) on conflict (enquiry_id) do update set enquiry_id = excluded.enquiry_id returning id, sent_at, tg_message_id, hubspot_deal_id`, [p.enquiryId]))!;
  const errors: string[] = [];

  // Telegram first: speed to the designer is the point.
  const chat = process.env.TELEGRAM_DESIGNERS_CHAT_ID;
  if (chat && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const text = (p.hold ? "🟣 <b>DESIGNER TO CONFIRM</b> (commercial under 500 sq ft — pending Nikhil)\n" : "") + handoffCard({ v: p.v, firstName: p.firstName, startedAt: p.startedAt, durationS: p.durationS, enquiryId: p.enquiryId });
      if (row.tg_message_id) await tg.edit(chat, row.tg_message_id, text, claimButtons(row.id));
      else {
        const m = await tg.send(chat, text, claimButtons(row.id));
        await q("update handoffs set tg_chat_id=$2, tg_message_id=$3, sent_at=coalesce(sent_at, now()) where id=$1", [row.id, String(m.chat.id), m.message_id]);
      }
    } catch (e) { errors.push(`telegram: ${String(e).slice(0, 160)}`); }
  } else errors.push("telegram: not configured");

  // HubSpot: qualified leads only (holds wait for Nikhil).
  if (!p.hold && process.env.HUBSPOT_TOKEN && !row.hubspot_deal_id) {
    try {
      const contactId = await hs.upsertContact({ firstname: p.firstName, phone: p.phone, email: p.email, locality: p.v.fields.locality, source: p.v.fields.source });
      const value = Number(await setting("avg_project_value_inr", "1100000"));
      const desc = [`Scope: ${p.v.fields.scope ?? "—"}`, `Timeline: ${p.v.fields.timeline ?? "—"}`, `Decision: ${p.v.fields.decision ?? "—"}`, `Source: ${p.v.fields.source ?? "—"}`,
        `Notes: ${p.v.noteForDesigner}`, p.summary ? `Call summary: ${redact(p.summary)}` : "", `Dashboard: ${appUrl()}/calls/${p.enquiryId}`].filter(Boolean).join("\n");
      const dealId = await hs.createDeal({ name: `${p.firstName ?? "Enquiry"} · ${p.v.fields.locality ?? "Pune"} · ${p.v.fields.property ?? p.v.segment}`, amountInr: value, contactId, description: desc, priority: p.v.priority });
      await q("update handoffs set hubspot_deal_id=$2, hubspot_contact_id=$3 where id=$1", [row.id, dealId, contactId]);
    } catch (e) { errors.push(`hubspot: ${String(e).slice(0, 160)}`); }
  }

  // Email copy for the record.
  try {
    const to = [process.env.TEAM_EMAIL || "", ...(p.v.priority === "previously_dropped" ? [process.env.FOUNDER_EMAIL || ""] : [])];
    const id = await sendEmail({
      to, subject: `${p.hold ? "Designer to confirm" : "Qualified lead"}: ${p.firstName ?? "Caller"} · ${p.v.fields.locality ?? "Pune"}`,
      html: `<p><b>${p.hold ? "Designer to confirm" : "Qualified lead"}</b> · ${p.v.fields.locality ?? ""} · ${[p.v.fields.property, p.v.fields.size].filter(Boolean).join(", ")}</p>
             <p>Scope: ${tg.esc(p.v.fields.scope ?? "—")}<br>Timeline: ${tg.esc(p.v.fields.timeline ?? "—")}<br>Decision: ${tg.esc(p.v.fields.decision ?? "—")}<br>Notes: ${tg.esc(p.v.noteForDesigner)}</p>
             <p><a href="${appUrl()}/calls/${p.enquiryId}">Open in the dashboard</a></p>`,
    });
    if (id) await q("update handoffs set email_id=$2 where id=$1", [row.id, id]);
  } catch (e) { errors.push(`email: ${String(e).slice(0, 160)}`); }

  if (errors.length) throw new Error(errors.join("; "));
}
