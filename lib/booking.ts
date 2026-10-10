import { q, one } from "./db";
import * as cal from "./calcom";
import * as hs from "./hubspot";
import * as tg from "./telegram";
import { sendEmail } from "./email";
import { slotLabel } from "./cards";
import { appUrl } from "./env";

/**
 * Books a consultation for an enquiry. Used by Telegram (designer taps a slot) and the dashboard.
 * calendar=true books it in Cal.com too; false records a time agreed by phone (no Cal.com booking).
 * Either way: consultation row, outcome, HubSpot stage, caller email (if we have one), records email.
 */
export async function bookConsultation(p: { enquiryId: string; startIso: string; designer: string; calendar: boolean }) {
  const r = await one<any>(`select e.id as enquiry_id, e.scope_text, e.locality, h.hubspot_deal_id, p.full_name, p.email, p.phone_e164
    from enquiries e left join handoffs h on h.enquiry_id = e.id left join people p on p.id = e.person_id where e.id = $1`, [p.enquiryId]);
  if (!r) throw new Error("Lead not found");
  const already = await one("select 1 from consultations where enquiry_id = $1 and status = 'booked'", [p.enquiryId]);
  if (already) throw new Error("This lead already has a consultation booked.");
  const records = process.env.TEAM_EMAIL || process.env.FOUNDER_EMAIL;
  let uid: string | null = null;
  if (p.calendar) {
    const attendeeEmail = r.email || records;
    if (!attendeeEmail) throw new Error("No caller email and no TEAM_EMAIL for the booking");
    const booking = await cal.book({ start: p.startIso, name: r.full_name || "Aangan enquiry", email: attendeeEmail, phone: r.phone_e164, notes: `Designer: ${p.designer}. Scope: ${r.scope_text ?? "—"}. Area: ${r.locality ?? "—"}. Lead: ${appUrl()}/calls/${r.enquiry_id}` });
    uid = booking?.uid ?? null;
  }
  await q(`insert into consultations (enquiry_id, status, booked_start, calcom_booking_uid, booked_by) values ($1,'booked',$2,$3,$4)`, [r.enquiry_id, p.startIso, uid, p.designer]);
  await q(`insert into outcomes (enquiry_id, stage, set_by) values ($1,'consultation_booked',$2)`, [r.enquiry_id, p.designer]);
  if (r.hubspot_deal_id) { try { await hs.moveDeal(r.hubspot_deal_id, "consultation_booked"); } catch (e) { console.error(e); } }
  const when = slotLabel(p.startIso);
  if (r.email) {
    await sendEmail({ to: r.email, subject: "Your Aangan Studio consultation", html: `<p>Hello ${tg.esc(r.full_name?.split(" ")[0] ?? "")},</p><p>Your consultation with ${tg.esc(p.designer)} from Aangan Studio is booked for <b>${tg.esc(when)}</b> (IST). ${tg.esc(p.designer)} will call you beforehand to confirm the details.</p><p>Thank you,<br>Aangan Studio</p>` });
  }
  await sendEmail({ to: records ?? "", subject: `Consultation booked: ${when} · ${r.locality ?? ""}`, html: `<p>${tg.esc(p.designer)} booked ${tg.esc(when)}${p.calendar ? "" : " (agreed by phone; not in Cal.com)"}.</p><p><a href="${appUrl()}/calls/${r.enquiry_id}">Lead</a></p>` });
  return { when, calendar: p.calendar, emailedCaller: Boolean(r.email) };
}

/**
 * Booked by the voice agent DURING a call (Vaani custom tool). The enquiry is created only after the
 * call, so the consultation is saved unlinked and attached by linkCallBookings() when the call is processed.
 */
export async function bookFromCall(p: { startIso: string; name: string; phone: string | null; email: string | null; callRef: string | null; notes: string }) {
  if (p.phone) {
    const dup = await one("select 1 from consultations where caller_phone = $1 and status = 'booked' and booked_start > now()", [p.phone]);
    if (dup) throw new Error("already booked");
  }
  const records = process.env.TEAM_EMAIL || process.env.FOUNDER_EMAIL;
  const attendeeEmail = p.email || records;
  if (!attendeeEmail) throw new Error("No caller email and no TEAM_EMAIL for the booking");
  const booking = await cal.book({ start: p.startIso, name: p.name || "Aangan enquiry", email: attendeeEmail, phone: p.phone, notes: `Booked by the AI agent on the call. ${p.notes}`.slice(0, 900) });
  await q(`insert into consultations (enquiry_id, status, booked_start, calcom_booking_uid, booked_by, caller_phone, call_ref, booked_via)
           values (null,'booked',$1,$2,'AI agent (on the call)',$3,$4,'agent')`, [p.startIso, booking?.uid ?? null, p.phone, p.callRef]);
  const when = slotLabel(p.startIso);
  await sendEmail({ to: records ?? "", subject: `Consultation booked on a call: ${when}`, html: `<p>The AI agent booked a consultation for ${tg.esc(when)} (IST) during a call. The lead appears on the dashboard when the call is processed.</p>` });
  return { when };
}

/**
 * After a call is processed: attach consultations the agent booked during it (same call reference, or the
 * same caller number in the last 2 hours), record the outcome and move the HubSpot deal.
 */
export async function linkCallBookings(p: { enquiryId: string; callRef: string | null; phone: string | null; hubspotDealId?: string | null }) {
  const rows = await q<{ id: string; booked_start: string }>(
    `update consultations set enquiry_id = $1
      where enquiry_id is null and booked_via = 'agent' and created_at > now() - interval '2 hours'
        and (($2::text is not null and call_ref = $2) or ($3::text is not null and caller_phone = $3))
      returning id, booked_start`, [p.enquiryId, p.callRef, p.phone]);
  if (!rows.length) return null;
  await q(`insert into outcomes (enquiry_id, stage, set_by) values ($1,'consultation_booked','AI agent')`, [p.enquiryId]);
  if (p.hubspotDealId) { try { await hs.moveDeal(p.hubspotDealId, "consultation_booked"); } catch (e) { console.error(e); } }
  return rows[0].booked_start;
}
