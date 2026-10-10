# Eval: T01–T20 (rules engine)

Accuracy: **19/19** scored cases (T08 is a missed call with no transcript).
Price figures in front-desk turns of the raw transcripts: **2** (the Vaani agent's target is 0; see note).

| ID | Expected | Got | ✓ | Detail | ₹ hits |
|---|---|---|---|---|---|
| T01 | qualified | qualified | ✅ | Kothrud · residential | 0 |
| T02 | qualified | qualified | ✅ | Wakad · residential · flags: decision_unclear | 0 |
| T03 | declined (area) | declined | ✅ | Nashik · residential · failed: service_area · flags: decision_unclear | 0 |
| T04 | declined (advice only) | declined | ✅ | ? · residential · failed: real_project · flags: decision_unclear | 0 |
| T05 | qualified | qualified | ✅ | Koregaon Park · residential · flags: decision_unclear, site_visit_requested · note: Caller would like a site visit (not promised). | 0 |
| T06 | qualified | qualified | ✅ | Baner · commercial | 0 |
| T07 | nurture (timeline, retry November) | nurture | ✅ | ? · residential · failed: timeline · flags: decision_unclear · follow-up 2026-11-10 | 0 |
| T08 | missed | answered by agent (no transcript to score) | ✅ | missed call — no transcript; now answered by the agent | 0 |
| T09 | complaint | complaint | ✅ | Viman Nagar · residential · flags: scope_unclear, decision_unclear, frustrated · priority: urgent | 0 |
| T10 | declined (volunteered budget) | declined | ✅ | Kharadi · residential · failed: budget · flags: area_to_confirm, decision_unclear | 1 |
| T11 | qualified | qualified | ✅ | Baner · residential · flags: decision_unclear, rented_no_structural · note: Rented; no structural changes; landlord OK. | 0 |
| T12 | qualified | qualified | ✅ | Kalyani Nagar · residential · flags: decision_unclear, site_visit_requested · note: Caller would like a site visit (not promised). | 0 |
| T13 | qualified | qualified | ✅ | Aundh · residential · flags: decision_unclear | 1 |
| T14 | qualified (parents decide) | qualified | ✅ | Hadapsar · residential · note: Decision with parents; both attending. | 0 |
| T15 | qualified | qualified | ✅ | Undri · residential · flags: site_visit_requested · note: Caller would like a site visit (not promised). | 0 |
| T16 | qualified (priority: previously dropped) | qualified | ✅ | Viman Nagar · residential · flags: scope_unclear, decision_unclear, previously_dropped, frustrated · priority: previously_dropped · note: Priority: previously dropped. Caller frustrated — handle with care. · history: previously dropped | 0 |
| T17 | qualified (merged (two calls)) | qualified | ✅ | Pimple Saudagar · residential · flags: decision_unclear, callback_after_drop · call 1 = incomplete; call 2 merged into the same enquiry | 0 |
| T18 | hold_designer_confirm (designer to confirm, pending Nikhil) | hold_designer_confirm | ✅ | ? · commercial · flags: scope_unclear, decision_unclear, commercial_under_500 · note: Commercial under 500 sq ft: designer to confirm (pending Nikhil). | 0 |
| T19 | declined (restaurant) | declined | ✅ | Koregaon Park · out_of_scope · failed: real_project · flags: decision_unclear | 0 |
| T20 | qualified | qualified | ✅ | Magarpatta · residential · flags: late_execution_start | 0 |

## WhatsApp and web form (same verdict code)

Accuracy: **20/20**

| ID | Expected | Got | ✓ | Detail | ₹ hits |
|---|---|---|---|---|---|
| W01 | qualified (after-hours message, no reply for 16 hours) | qualified | ✅ | whatsapp · Viman Nagar · flags: decision_unclear, site_visit_requested | 0 |
| W02 | incomplete (price-only question, never answered for 2 days) | incomplete | ✅ | whatsapp · ? · flags: scope_unclear, decision_unclear, needs_follow_up, price_only | 0 |
| W03 | qualified (Hindi) | qualified | ✅ | whatsapp · Pimple Nilakh · flags: scope_unclear, decision_unclear | 0 |
| W04 | qualified | qualified | ✅ | whatsapp · Chinchwad · flags: decision_unclear, site_visit_requested | 0 |
| W05 | qualified (Saturday after hours; lost after two follow-ups) | qualified | ✅ | whatsapp · Baner · flags: scope_unclear, decision_unclear | 0 |
| W06 | qualified | qualified | ✅ | whatsapp · Koregaon Park · flags: decision_unclear, site_visit_requested | 0 |
| W07 | declined (gym — out of scope) | declined | ✅ | whatsapp · Kothrud · failed: real_project · flags: decision_unclear | 0 |
| W08 | qualified (previously dropped — first message 4 days earlier got no reply) | qualified | ✅ | whatsapp · Aundh · flags: decision_unclear | 0 |
| W09 | qualified (3 photos attached) | qualified | ✅ | whatsapp · Aundh · flags: decision_unclear | 0 |
| W10 | nurture (early-stage interest; re-engage in 4–6 weeks) | nurture | ✅ | whatsapp · Hinjewadi · flags: scope_unclear, decision_unclear, early_stage · follow-up 2026-10-27 | 0 |
| F01 | qualified | qualified | ✅ | web_form · Kalyani Nagar | 0 |
| F02 | qualified | qualified | ✅ | web_form · Baner · flags: decision_unclear | 0 |
| F03 | declined (Talegaon — outside service area) | declined | ✅ | web_form · Talegaon · failed: service_area · flags: decision_unclear | 0 |
| F04 | incomplete (price-only form, no project details) | incomplete | ✅ | web_form · Pune (area not named) · flags: scope_unclear, decision_unclear, needs_follow_up, price_only | 0 |
| F05 | qualified (commercial, 2,200 sq ft) | qualified | ✅ | web_form · Hinjewadi · flags: decision_unclear | 0 |
| F06 | qualified | qualified | ✅ | web_form · NIBM · flags: decision_unclear | 0 |
| F07 | incomplete (anonymous price-list request) | incomplete | ✅ | web_form · Pune (area not named) · flags: scope_unclear, decision_unclear, needs_follow_up, price_only | 0 |
| F08 | declined (needs it in 3 weeks — timeline) | declined | ✅ | web_form · Wakad · failed: timeline · flags: decision_unclear | 0 |
| F09 | qualified | qualified | ✅ | web_form · Kondhwa · flags: decision_unclear | 0 |
| F10 | qualified | qualified | ✅ | web_form · Aundh | 0 |
