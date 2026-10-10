import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import * as tg from "@/lib/telegram";
import * as hs from "@/lib/hubspot";
import * as cal from "@/lib/calcom";
import { sendEmail } from "@/lib/email";
import { handoffCard, claimButtons, passReasonButtons, slotLabel } from "@/lib/cards";
import { ruleVerdict } from "@/lib/verdict";
import { appUrl } from "@/lib/env";
import { bookConsultation } from "@/lib/booking";

export const runtime = "nodejs";
export const maxDuration = 30;

const REASONS: Record<string, string> = { busy: "too busy", speciality: "not my speciality", location: "location" };

/** Rebuild the card from stored data so edits always show the latest state. */
async function card(handoffId: string) {
  const r = await one<any>(`select h.*, e.id as enquiry_id, e.created_at as e_created, p.full_name, k.started_at, k.duration_s, t.turns, t.entities, v.criteria
    from handoffs h join enquiries e on e.id = h.enquiry_id left join people p on p.id = e.person_id
    left join lateral (select * from calls where enquiry_id = e.id order by started_at desc limit 1) k on true
    left join transcripts t on t.call_id = k.id
    left join lateral (select criteria from verdicts where enquiry_id = e.id order by created_at desc limit 1) v on true
    where h.id = $1`, [handoffId]);
  if (!r) return null;
  const v = ruleVerdict(r.turns ?? [], { callDate: new Date(r.started_at ?? r.e_created), entities: r.entities ?? {} });
  if (r.criteria) v.criteria = r.criteria;
  const text = handoffCard({ v, firstName: r.full_name?.split(" ")[0] ?? null, startedAt: r.started_at ?? r.e_created, durationS: Number(r.duration_s) || null, enquiryId: r.enquiry_id, claimedBy: r.claimed_by_name, passes: r.passes, escalation: r.escalation_level });
  return { r, text };
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) return NextResponse.json({ error: "forbidden" }, { status: 401 });
  const update = await req.json();
  const cb = update.callback_query;
  if (!cb) return NextResponse.json({ ok: true });

  const [action, handoffId, arg] = String(cb.data ?? "").split(":");
  const who = [cb.from?.first_name, cb.from?.last_name].filter(Boolean).join(" ") || cb.from?.username || "Designer";
  const designer = await one<{ id: string; name: string; email: string | null; hubspot_owner_id: string | null }>("select id, name, email, hubspot_owner_id from designers where telegram_user_id = $1 and active", [cb.from?.id]);
  const anyDesigners = await one<{ n: number }>("select count(*)::int as n from designers where telegram_user_id is not null");
  if (anyDesigners?.n && !designer) { await tg.answer(cb.id, "Only studio designers can claim leads."); return NextResponse.json({ ok: true }); }
  const name = designer?.name ?? who;
  const chatId = cb.message?.chat?.id;
  const msgId = cb.message?.message_id;

  try {
    if (action === "claim") {
      const claimed = await one<{ id: string }>(`update handoffs set claimed_at = now(), claimed_by = $2, claimed_by_name = $3 where id = $1 and claimed_at is null returning id`, [handoffId, designer?.id ?? null, name]);
      if (!claimed) { await tg.answer(cb.id, "Already claimed."); return NextResponse.json({ ok: true }); }
      await tg.answer(cb.id, "It's yours. Pick a slot next.");
      const c = await card(handoffId);
      if (c && chatId && msgId) await tg.edit(chatId, msgId, c.text, []);
      if (c?.r.hubspot_deal_id) {
        const owner = designer?.hubspot_owner_id ?? (await hs.ownerIdForEmail(designer?.email));
        try { await hs.moveDeal(c.r.hubspot_deal_id, "claimed", owner ? { hubspot_owner_id: owner } : {}); } catch (e) { console.error(e); }
      }
      // Slot picker: at most 3 open times that fit the caller's own windows.
      try {
        const e = await one<{ preferred_slots: string | null }>("select preferred_slots from enquiries where id = $1", [c?.r.enquiry_id]);
        const slots = cal.pickSlots(await cal.availableSlots(7), e?.preferred_slots ?? null);
        const bookLink = `<a href="${appUrl()}/calls/${c?.r.enquiry_id}#book">book it on the dashboard</a>`;
        if (!slots.length) {
          await tg.send(chatId, `📅 <b>${tg.esc(name)}</b>: Cal.com has no open times right now. Call the caller to agree a time, then ${bookLink}. (Caller asked for: ${tg.esc(e?.preferred_slots ?? "no preference")})`);
          return NextResponse.json({ ok: true });
        }
        const buttons = slots.map((s) => [{ text: slotLabel(s), callback_data: `slot:${handoffId}:${Math.floor(new Date(s).getTime() / 1000)}` }]);
        buttons.push([{ text: "None fit — I'll call to agree a time", callback_data: `call:${handoffId}` }]);
        await tg.send(chatId, `📅 <b>${tg.esc(name)}</b>, pick the consultation time (caller asked for: ${tg.esc(e?.preferred_slots ?? "no preference")})`, buttons);
      } catch (err) {
        await tg.send(chatId, `📅 ${tg.esc(name)}: couldn't load Cal.com slots (${tg.esc(String(err).slice(0, 80))}). Call the caller to agree a time, then <a href="${appUrl()}/calls/${c?.r.enquiry_id}#book">book it on the dashboard</a>.`);
      }
    } else if (action === "pass") {
      await tg.answer(cb.id, "Why are you passing?");
      if (chatId) await tg.send(chatId, `${tg.esc(name)}, why pass on this lead?`, passReasonButtons(handoffId));
    } else if (action === "passr") {
      await q(`update handoffs set passes = passes || $2::jsonb where id = $1`, [handoffId, JSON.stringify([{ name, reason: REASONS[arg] ?? arg, at: new Date().toISOString() }])]);
      await tg.answer(cb.id, "Noted. Nikhil can see passes and reassign.");
      const c = await card(handoffId);
      if (c?.r.tg_chat_id && c.r.tg_message_id) await tg.edit(c.r.tg_chat_id, c.r.tg_message_id, c.text, c.r.claimed_at ? [] : claimButtons(handoffId));
      if (chatId && msgId) await tg.edit(chatId, msgId, `Pass recorded: ${tg.esc(name)} (${tg.esc(REASONS[arg] ?? arg)})`, []);
    } else if (action === "slot") {
      const startIso = new Date(Number(arg) * 1000).toISOString();
      const h = await one<{ enquiry_id: string }>("select enquiry_id from handoffs where id = $1", [handoffId]);
      if (!h) throw new Error("handoff not found");
      const b = await bookConsultation({ enquiryId: h.enquiry_id, startIso, designer: name, calendar: true });
      await tg.answer(cb.id, "Booked.");
      if (chatId && msgId) await tg.edit(chatId, msgId, `✅ Consultation booked: <b>${tg.esc(b.when)}</b> with ${tg.esc(name)}${b.emailedCaller ? " · caller emailed" : " · call the caller to confirm"}`, []);
    } else if (action === "call") {
      await tg.answer(cb.id, "Okay — book it on the dashboard once agreed.");
      const hc = await one<{ enquiry_id: string }>("select enquiry_id from handoffs where id = $1", [handoffId]);
      if (chatId && msgId) await tg.edit(chatId, msgId, `📞 ${tg.esc(name)} will call the caller to agree a time, then <a href="${appUrl()}/calls/${hc?.enquiry_id}#book">book it on the dashboard</a>.`, []);
    }
  } catch (e) {
    console.error("[telegram]", e);
    try { await tg.answer(cb.id, "Something went wrong — check the dashboard."); } catch { /* ignore */ }
  }
  return NextResponse.json({ ok: true });
}
