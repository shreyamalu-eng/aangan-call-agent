# Aangan Studio: inbound call agent plan

**Status:** plan for approval. No code is written until you sign off.
**Prepared:** 9 Oct 2026, from the brief, `qualified.md`, `services.md`, `pricing.md` and the September transcripts (T01–T20, W01–W10, F01–F10).

---

## 0. Vaani: confirmed against docs.vaanivoice.ai (v2, 9 Oct)

- **Platform:** `app.vaanivoice.ai`, with the API at `https://api.vaanivoice.ai`. Auth is the `X-API-Key` header.
- **Agent config:** `PATCH /api/agent/{id}/persona|training|experience|analysis|deployment`.
- **Webhooks:** `call_started`, `call_ended`, `call_postprocessing` and `human_transfer_*`, signed with HMAC-SHA256 and retried 5 times.
- **Lookups:** `GET /api/call_details/{client}/{call_id}` and `GET /api/transcript/{call_id}` are the fallback when a postprocessing event doesn't arrive.

**Not in the docs:**

- **Mid-call custom functions.** `actions.functions[]` exists, but its shape isn't documented, so **v2 doesn't need mid-call functions**.
- **Per-call cost.** No payload carries it, so v2 allocates the invoice by call minutes.
- **A business-hours schedule.** Time routing moves to telephony.
- **Marathi.** Not confirmed.

Full field mapping and the remaining questions for Vaani: **COMPONENTS.md §0 and §9**.

## 1. Components map

→ Rebuilt in **COMPONENTS.md** (v2). It covers:

- telephony options for the studio number +91 84610 08800
- system lanes
- the component hierarchy for the voice, Telegram, dashboard and backend surfaces
- states and data flow
- responsive rules
- tokens
- accessibility and events
- ownership

---

## 2. API call flow

> **v2 changes.** The steps below change in four places:
>
> - **Steps 1–4:** studio SIM forward-all → Exotel time-based flow → front desk (20s) or Vaani. Exotel status callbacks log every leg.
> - **Steps 6, 9 and 11 (mid-call functions):** these become post-call. `call_started` (with `phone_number`) runs `S-MATCH` at once and pages the senior person if the caller has an active project. The agent gets repeat context from Vaani `memories`, checks area from the locality list in its prompt, and slots come back as an extracted field.
> - **Step 14:** a single `POST /api/vaani/webhook` handles all events.
> - **Step 23:** Vaani cost comes from invoice allocation.
>
> Step-by-step detail is in COMPONENTS.md §2 and §4.

Steps marked **[no API]** are internal logic or database work with no external API call.

**A. Call arrives**
1. Caller dials the studio number. The telephony provider applies the time-based routing. **[telephony config, no API from us]**
2. In hours, the call rings the front desk for 20 seconds. If it's answered, go to step 25. If it's busy or unanswered, it's forwarded over SIP to Vaani.
3. After hours, the call is forwarded to Vaani immediately, which answers within 3 rings.
4. If the Vaani leg fails or times out, the call goes to voicemail. The telephony provider calls `POST /api/telephony/status` with `status=failed`. We create a `calls` row (`answered_by=voicemail`) and send a Telegram alert to the front desk. Every call gets a log row, even on failure.

**B. During the call**

5. Vaani speaks the disclosure in its first sentence (AI assistant, call recorded). **[no API]**
6. Vaani calls `POST /api/vaani/functions/lookup_caller` with `{ phone }`.
   - The backend hashes the phone and matches it in `people` **[DB only]**.
   - If the same number called within the last 30 minutes, it returns `merge_into: enquiry_id` (T17).
   - If an earlier enquiry has no follow-up and no handoff, it returns `previously_dropped: true` (T16).
   - If the number matches an active project, it returns `active_project: true`, along with the designer's first name (T09).
   - It returns the `enquiry_id` the call is attached to. A new enquiry row is created here, so the call is logged before it ends.
7. If the caller has an active project or complains: during hours, Vaani warm-transfers to the senior/on-call number. After hours, it calls `escalate`. The backend sends a Telegram page to Nikhil immediately and creates an `escalations` row, and the agent promises a callback. The call never enters the sales pipeline.
8. The agent asks the scope question (criterion 1). **[no API]**
9. Vaani calls `POST /api/vaani/functions/check_service_area` with `{ locality }`. The backend matches it against the `localities` table, seeded from `services.md` plus aliases Nikhil approves, and returns `in`, `out` or `unclear` **[DB only]**. On `unclear`, the agent asks one direct question: "Is that within Pune city or PCMC?"
10. The agent asks the timeline question (criterion 3), then decision-maker, then source. It never asks about budget. **[no API]**
11. If the call is heading toward qualified, the agent asks for 2–3 preferred consultation windows. Vaani calls `POST /api/vaani/functions/request_consultation` with `{ enquiry_id, preferred_slots }`, and we store it as `requested`. The agent says: "Your designer will confirm the exact time." It never confirms a slot.
12. If the caller asks for a human: during hours, warm transfer to the front desk. After hours, `escalate(reason="human_requested")` books a callback window and flags it urgent.
13. The call ends. A dropped call ends here too. **[no API]**

**C. After the call**

14. Vaani sends `POST /api/vaani/call-ended`. (If Vaani has no webhook, the fallback is that `/api/cron/vaani-poll` fetches new call logs every 2 minutes.)
15. We verify the signature, then store the raw event in `webhook_events`, keyed by `vaani_call_id` so it's processed only once. **[DB only]**
16. We redact the transcript, replacing the caller's name and every phone or email pattern with `[CALLER]`, `[PHONE]` or `[EMAIL]`. PII goes to `people`. The redacted turns go to `transcripts`. **[no API]**
17. We run the deterministic price check. A regex catches ₹, Rs, INR, lakh, lac, crore, "per sq ft" next to a rupee figure, and हजार / लाख / रुपये in agent turns. Its result goes into the verdict and the report. **[no API]**
18. **LLM call.** The verdict model gets the redacted transcript, Vaani's extracted fields, the function results (area status, merge or dropped flags) and today's date. It returns JSON matching the schema in §3.
19. **Routing rules** run in code, not in the LLM; the LLM only fills in the criteria. **[no API]**
   - All criteria pass or unclear-on-4/5 → `qualified`
   - Exactly one clear fail → `declined` (with the criterion)
   - Two or more fails → `declined`
   - Timeline fail where the caller offered a later start → `nurture`, with a follow-up date
   - Commercial under 500 sq ft → `hold_designer_confirm` (see open questions)
   - Complaint → `complaint`
   - Wrong number or a vendor pitch → `non_enquiry`
20. If qualified: `sendMessage` to the designers' group with the note and Claim / Pass inline buttons, then `handoffs.sent_at` is set. The goal is under 5 minutes from call end; the target is under 60 seconds.
21. Email copy through **Resend** `POST /emails` to the records inbox.
22. If previously dropped: Telegram DMs to the senior designer and Nikhil, and the note is marked `⚠️ Priority: previously dropped`.
23. We write `cost_events`:
    - Vaani's reported per-call cost
    - LLM tokens × the active row in `provider_rates`
    - Telegram ₹0
    - Resend: the monthly invoice allocated per email
    **[DB only]**
24. Every minute, `pg_cron` calls `/api/cron/sla`. **[DB only, plus Telegram sends]**
    - T+15 min unclaimed → DM the front desk lead
    - T+30 min unclaimed → DM Nikhil
    - T+60 min unclaimed → `sla_breached`, which appears in *Needs attention*
    - Nurture follow-ups that are due → front desk queue

**D. Human side**

25. Calls answered by the front desk only have a CDR, no transcript. The bot DMs the front desk: "Call 11:02, 4m, ending ••47: outcome?" with buttons for New enquiry / Existing client / Other. A new enquiry gets a 6-field quick-log link, so even these calls get an owner.
26. A designer taps **Claim**. Telegram sends `callback_query` to `POST /api/telegram/webhook`. We check `X-Telegram-Bot-Api-Secret-Token` and that the tapper is in `designers`, then set `claimed_by` and `claimed_at`, call `answerCallbackQuery`, and `editMessageText` to show "Claimed by Riya · 11:20pm". **Pass** records the pass and leaves the note open for others.
27. The designer confirms the slot and later the stage (consultation done → proposal → signed or lost) on the dashboard. Each change writes to `outcomes`. **[DB only]**
28. The dashboard reads Supabase views. Nobody pulls numbers by hand. **[DB only]**

---

## 3. Data model (Supabase / Postgres)

PII lives only in `people`. Row-level security limits it to the `service_role` and to dashboard users with the `staff` role. The verdict path never selects from `people`.

```text
people              id, full_name, phone_e164, phone_hash (sha256+pepper), email, created_at
designers           id, name, role(designer|senior|front_desk_lead|founder|front_desk),
                    telegram_user_id, email, on_call bool, active
active_projects     id, person_id→people, designer_id, status, started_at
localities          name, aliases[], zone(pune|pcmc), status(in|out|confirm)   -- seeded from services.md
enquiries           id, person_id→people, channel(phone|whatsapp|web_form), source(referral|instagram|
                    linkedin|google|other), referrer_text, segment(residential|commercial|out_of_scope),
                    property_type, locality, area_status, size_sqft, scope_text, timeline_text,
                    required_by date, ownership(owned|rented|unknown), decision_text,
                    status(new|qualified|declined|nurture|complaint|non_enquiry|hold_designer_confirm),
                    decline_criteria text[], priority(normal|previously_dropped|urgent),
                    owner_designer_id, follow_up_at, merged_into→enquiries, created_at, updated_at
calls               id, enquiry_id, provider_call_id, vaani_call_id unique, started_at, answered_at,
                    ended_at, ring_seconds, answered_by(front_desk|agent|voicemail|none),
                    in_hours bool, language, duration_s, end_reason, dropped bool, recording_ref
transcripts         call_id PK, turns jsonb (redacted), vaani_analysis jsonb, extracted jsonb
verdicts            id, enquiry_id, call_id, model, prompt_version, criteria jsonb, outcome,
                    flags text[], confidence, note_for_designer, price_figure_spoken bool,
                    price_regex_hits jsonb, tokens_in, tokens_out, latency_ms, raw jsonb
consultation_requests id, enquiry_id, preferred_slots jsonb, mode_pref(site|studio|unknown),
                    status(requested|confirmed|cancelled), confirmed_slot, confirmed_by, confirmed_at
handoffs            id, enquiry_id, tg_chat_id, tg_message_id, sent_at, claimed_by, claimed_at,
                    passes jsonb, escalation_level int, sla_breached bool, email_id
escalations         id, enquiry_id, call_id, reason(complaint|human_requested|vaani_failure|sla),
                    paged_to[], paged_at, acknowledged_by, acknowledged_at, resolved_at
outcomes            id, enquiry_id, stage(consultation_done|proposal|signed|lost), value_inr,
                    set_by, set_at, note
cost_events         id, call_id null, enquiry_id null, provider(vaani|llm|telegram|resend|vercel|supabase|
                    telephony), units, unit_type, amount_inr, amount_orig, currency_orig,
                    basis(provider_reported|usage_x_rate|invoice_allocation), period, occurred_at
provider_rates      provider, unit_type, rate, currency, fx_to_inr, effective_from, source_url
                    -- edited in the dashboard from invoices or pricing pages; never in code
settings            key, value  -- avg_project_value_inr=1100000, hours=10:00–19:00, sla_minutes, holidays
webhook_events      id, source(vaani|telegram|telephony), external_id, signature_ok, payload, received_at,
                    processed_at, error
```

**Verdict JSON schema** (the LLM fills this in; code decides the routing):

```json
{
  "criteria": {
    "real_project":   {"result": "pass|fail|unclear", "evidence": "…"},
    "service_area":   {"result": "…", "evidence": "…"},
    "timeline":       {"result": "…", "weeks_to_required_completion": 22, "evidence": "…"},
    "budget":         {"result": "pass|fail|not_mentioned", "evidence": "…"},
    "decision_maker": {"result": "…", "evidence": "…"}
  },
  "segment": "residential|commercial|out_of_scope",
  "out_of_scope_reason": null,
  "is_complaint": false,
  "caller_offered_later_start": false,
  "suggested_follow_up": null,
  "handoff_fields": {"locality": "", "size": "", "scope": "", "timeline": "", "decision": "", "source": ""},
  "flags": ["timeline_6_10_weeks", "commercial_under_500", "proxy_caller", "frustrated", "low_confidence"],
  "note_for_designer": "…",
  "price_figure_spoken_by_agent": false,
  "confidence": 0.0
}
```

---

## 4. Vaani agent prompt (draft v1)

> **v2 changes to this prompt:**
>
> - **First sentence:** moves to `greeting_message.agent_message` with `interruptible:false`.
> - **Function calls:** `lookup_caller()` becomes Vaani `memories`. `check_service_area()` becomes the inline locality list (`V-A-Localities`). `request_consultation()` becomes the `preferred_slots` extraction field. `escalate()` becomes a warm transfer, with a callback if the transfer fails, while the backend pages Nikhil from the webhook.
> - **Source of truth:** the prompt is generated from `/agent/blocks` (COMPONENTS.md §3.1).

```text
ROLE
You are the phone assistant for Aangan Studio, an interior design studio in Pune.
You answer calls the front desk can't take. Your job: understand the caller's project,
check five things, request a consultation for good fits, and decline honestly when it isn't a fit.
Designers decide pricing, slots and design. You never do.

FIRST SENTENCE (always, in the caller's language once known; start in English)
en: "Hello, you've reached Aangan Studio — I'm the studio's AI assistant, and this call is recorded."
hi: "नमस्ते, आप Aangan Studio से बात कर रहे हैं — मैं स्टूडियो की AI असिस्टेंट हूँ, और यह कॉल रिकॉर्ड हो रही है।"
mr: "नमस्कार, Aangan Studio मध्ये आपले स्वागत — मी स्टुडिओची AI सहाय्यक आहे, आणि हा कॉल रेकॉर्ड होत आहे."
Then: "How can I help?"

LANGUAGE
Reply in the language the caller uses (English, Hindi or Marathi). Switch if they switch.
Keep sentences short. One question at a time.

AT CALL START
Call lookup_caller(phone).
- active_project = true, or the caller describes a problem with an ongoing project →
  apologise once, don't troubleshoot. In hours: say you're connecting them to a senior
  person and warm-transfer to SENIOR. After hours: call escalate(enquiry_id, "complaint"),
  say "I've alerted our studio head right now; a senior person will call you back
  within 15 minutes of the studio opening, or sooner." (Wording pending Nikhil, Q8.)
  Do not continue qualifying.
- previously_dropped = true → "I'm sorry we didn't get back to you after your last call.
  That shouldn't have happened. Let me take this properly now."
- merge_into is set (called back within 30 min) → "Sorry we got cut off. Let's pick up
  where we were." Don't re-ask anything you already know.

QUESTION ORDER (skip anything already answered)
1. Scope: "What are you looking to do?" Then property type and approx size.
   Real project = design + execution, at least one full room. If they want ideas or
   advice only, or will do execution themselves, ask once: "Are you looking for us to
   design and execute it, or mainly for advice?"
2. Location: "Where is the property?" → check_service_area(locality).
   unclear → "Is that within Pune city or PCMC?"
3. Timeline: "When would you need the project complete?"
   If they rent: "Are you planning any structural changes, and is the landlord okay with the work?"
4. Decision: "Will you be making the decision, or is someone else involved?"
   If someone else decides: "Would they be able to attend the consultation?"
5. Source: "How did you hear about us?"
6. Name, and confirm this number is the best one to call back on.
7. If a fit: ask for two or three time windows that suit them → request_consultation.
   Say: "I've requested that. Your designer will confirm the exact time with you."
8. Recap in one or two sentences. Close warmly.

DON'T ASK ABOUT BUDGET. If the caller volunteers an amount that is clearly far below
the scope they described (e.g., a kitchen plus a bedroom with full execution for one to
one-and-a-half lakh), say kindly, WITHOUT repeating or naming any figure:
"Thank you for being upfront. I want to be honest — for that scope with full execution,
that budget would be well below what a project like this costs with us, and I wouldn't
want to waste your time with a consultation. A local contractor may be a better fit."
If unsure whether it's below, don't comment; note it.

PRICING — the only allowed answer, word for word (translate faithfully for hi/mr):
"Pricing depends on the site, the materials you choose, and the scope — your designer
will walk you through it in detail at the consultation. I can book that for you right now
if you'd like."
If they push again, repeat it gently and continue with the next question.
NEVER say any number, range, per-sq-ft figure, "it'll cost around", "our rates start at",
"for a 2BHK it's typically", or compare costs ("premium is 3× standard"). Never mention
discounts. Never say the consultation is free unless the knowledge base says so.

WHAT WE DO / DON'T: use only the knowledge base. If it isn't there, say
"Your designer will confirm that." Never promise dates, availability, site visits,
specific designers, or outcomes.

TIMELINE RULE
If the project must be complete in under 6 weeks from today: explain honestly —
"Design alone takes three to four weeks, and execution follows, so we couldn't do
justice to it in that time." Offer a later start. If they want to think about it, ask
when to check back and say the studio will follow up.

DECLINES (warm, honest, give the reason)
- Out of area: "We only work in Pune city and PCMC — our contractors need to be on site,
  and we don't have that network in <place>. I'm sorry we can't help with this one."
- Advice only: "We're a full-service studio — design and execution together, with a
  full room as the smallest project. If you decide to go ahead with a redesign, we'd
  love to hear from you."
- Out-of-scope type (restaurant, hotel, retail, gym, architecture/structural, decor only,
  furniture sourcing only, Vastu only): name the reason from the knowledge base and
  suggest they look for a specialist. Don't name other firms.
- Two or more problems: "This sounds like it may not be the right fit for us right now —
  but feel free to reach out if your timeline or scope changes."
- Commercial space under 500 sq ft: don't decline. "Thanks — I'll pass this to our team,
  and a designer will confirm whether it's something we can take on."

NEVER DISQUALIFY FOR: not knowing what they want, calling late, asking about price,
style uncertainty, a single-room project, a rented flat with no structural changes.

HUMAN REQUEST: In hours → warm transfer to FRONT_DESK. After hours → ask for a callback
window, call escalate(enquiry_id, "human_requested"), and tell them the studio will call back.

STYLE: warm, unhurried, Pune-local. No jargon. Never argue. Never invent.
```

Settings: temperature 0.2 (if Vaani exposes it). The knowledge base is `services.md` only. `pricing.md` is never uploaded to Vaani.

---

## 5. Verdict expectations vs. the rules, and conflicts I found

| ID | Expected | How the rules get there |
|---|---|---|
| T01 | Qualified | All five pass |
| T02 | Qualified | Pricing push → deflection; Wakad is in area |
| T03 | Decline (area) | Nashik is out |
| T04 | Decline (advice) | Criterion 1 fails |
| T05 | Qualified | Note: caller wants a site visit (preference only, not promised) |
| T06 | Qualified | Commercial, 800 sq ft, Baner |
| T07 | Nurture | Under 6 weeks; caller said "let me think" → follow-up in November |
| T08 | Missed → answered | No transcript exists. I'll write a **synthetic** Marathi caller from Nanded City and label it as synthetic |
| T09 | Escalate | Complaint, in hours → warm transfer |
| T10 | Decline (budget) | Volunteered budget clearly below scope. Kharadi needs an alias (see open questions) |
| T11 | Qualified | Rented, no structural changes, landlord OK |
| T12 | Qualified | 5,500 sq ft villa; residential has no cap |
| T13 | Qualified | Pricing push ×2 |
| T14 | Qualified + note | "Decision with parents; both attending." |
| T15 | Qualified | Possession in about 6 weeks; site accessible now |
| T16 | Qualified, priority | Needs a **seeded prior enquiry** in the test fixtures, because the Monday call was never logged |
| T17 | Qualified, merged | Two calls → one enquiry |
| T18 | Decline* | `hold_designer_confirm`. Not forwarded to the pool; routed to Nikhil (see open questions) |
| T19 | Decline | Restaurant |
| T20 | Qualified | Note: January execution start (see open questions) |

Price-figure check: the deterministic regex and the LLM check both run on every agent turn in all 20 replays. The target count is 0.

**Test method.** A text simulator plays each transcript's caller with an LLM persona. It runs against the same agent prompt and the real function endpoints, and answers each agent turn using the transcript's facts. It then runs the verdict on (a) the simulated call and (b) the raw transcript. Accuracy is reported both ways. I'll also run three live voice calls (T01, T19, T14) on the real Vaani number once telephony is up. A text simulation tests logic, not voice or ASR, and the report will say so.

---

## 6. Open questions for Nikhil (logged in the README, not decided silently)

1. **Commercial minimum.** T18 was declined as "below our 500 sq ft minimum", but `services.md` states no minimum. Until Nikhil confirms, anything under 500 sq ft is `hold_designer_confirm`, routed to Nikhil and not the pool. On the call, the agent neither forwards nor declines. Your expected-verdict table says "Decline" for T18. I'm scoring it correct if it's *not forwarded to the pool* and *not falsely promised*. OK?
2. **Timeline floor.** `qualified.md` says 8–10 weeks and `services.md` says 6 weeks. As you specified: under 6 weeks from today = fail, 6–10 weeks = pass with a flag.
3. **"Site available within 8–10 weeks of the consultation."** Read strictly, this fails **T20** (January execution start, about 14 weeks out), which you expect to qualify. So a late *start* is a flag ("late execution start — designer to plan"), never a fail. Nikhil should confirm.
4. **Is the consultation free?** The front desk told T02 and T13 that "the consultation is free and there's no obligation". That isn't in `services.md`, so the agent won't say it. If it's true, add it to `services.md`.
5. **Site visits.** T05 and T12 were offered site visits. `services.md` doesn't mention them. The agent records the preference but doesn't promise one.
6. **Locality list.** Kharadi (T10), Nanded City (T08), Wagholi, Bavdhan, Pashan, Sus, Balewadi, Moshi, Bhosari and Wakad-adjacent areas aren't named. "Adjoining areas" is vague. Please send a yes/no list. Until then, unlisted localities return `unclear`, and the agent asks the one direct question.
7. **Overnight SLA.** Should the 15- and 30-minute escalations DM the front desk lead and Nikhil at 1am? My proposal: after hours, a lead is claimable overnight, and the escalation clock starts at 10am. Complaints still page Nikhil immediately.
8. **Complaint callback promise after hours.** What may the agent promise? "Within 15 minutes" at 11pm isn't something anyone has committed to.
9. **Who is "senior/on-call"** for complaints and previously dropped leads? Is it one number or a rotation?
10. **Handoff names.** The designer note includes the caller's first name and locality, but no phone number. Designers get the phone number from the dashboard after they tap Claim. OK?

---

## 7. Technical questions for you

1. **Telephony:** do you approve Option B (studio SIM forward-all to an Exotel number with a time-based flow)? Option A (SIM-only forwarding) can't meet the "every call logged" and "answered %" goals. See COMPONENTS.md §1.
2. **Vaani support:** please send them the 9 questions in COMPONENTS.md §9. v1 doesn't depend on any of the answers, but #2 (webhook signing), #3 (cost) and #4 (Marathi) affect launch.
3. **Scheduler:** Supabase `pg_cron` for the SLA job. OK?
4. **Verdict model:** a Haiku-class model by default. OK?
5. **Costs:** Vaani, Exotel, Vercel, Supabase and Resend invoices go in through the dashboard's Rate editor and are allocated by usage. OK?

## 8. Repo layout (built after approval)

```text
/supabase/migrations/0001_core.sql … 0004_views.sql, seed_localities.sql
/app/api/vaani/webhook/route.ts          (all Vaani events; replaces /call-ended)
/app/api/vaani/functions/*               (v2: stubs only, enabled once Vaani confirms actions.functions shape)
/agent/blocks/*.ts + scripts/push-agent.ts
/app/api/telegram/webhook/route.ts
/app/api/telephony/status/route.ts
/app/api/cron/{sla,vaani-poll}/route.ts
/app/(dashboard)/{page,leads,leads/[id],attention,costs,settings}/page.tsx   (WCAG 2.2 AA, mobile-first)
/lib/{vaani/adapter.ts, verdict/, routing.ts, redact.ts, priceGuard.ts, telegram.ts, email.ts, costs.ts}
/agent/{system-prompt.md, knowledge/services.md}
/eval/{transcripts/T01–T20.json, simulate.ts, run.ts, report.md}
.env.example · .gitignore (.env) · README.md (setup, open questions, extension note)
```
