# Foundation readiness check: Aangan call agent (Vaani assignment)

**Checked:** 10 Oct 2026, against the project-check criteria and the Vaani assignment rules (due today, end of day).
**Covers:** PLAN.md, COMPONENTS.md, the visual map, and the six new tools (Vaani, Neon, HubSpot, Cal.com, Resend, GitHub), plus Telegram and Vercel.

## 1. Verdict

The thinking is solid: rubric, edge cases, the pricing cut, open questions and states. **Four things would lose marks today and are fixed below:**

| # | Problem | Fix |
|---|---|---|
| 1 | The visual map used Answer / Talk / Decide / Hand off, **not the six required labels**. | Rebuilt with Trigger → Input → Context → Processing → AI → Output, as two rows: during the call (inside Vaani) and after the call (our app). |
| 2 | The plan leaned on **Supabase** (`pg_cron`, RLS), and it pauses. | **Neon** Postgres. Frequent jobs run on GitHub Actions; health alerts go to Telegram. |
| 3 | **Exotel** and the studio SIM can't be tested: the assignment gives **no phone numbers**, only Vaani's WebRTC "Start test". | Telephony becomes a production note only. Building it now would be a feature that exists but doesn't work. The agent **asks for the caller's number**, because WebRTC has no caller ID. |
| 4 | The prompt has **no angry-caller section**, and the agent can't know **today's date** inside the closed bubble. | Add a de-escalation block. A daily job rewrites a "Today is …" line in the Vaani prompt through the API. |

**What still needs you:** API keys (§8) and one decision, which is to confirm that **Vaani booking stays OFF** (§3).

---

## 2. Assignment rules → what changes

| Rule | Effect on our design | Status |
|---|---|---|
| The call is a **closed bubble** | Already designed for it: v2 uses no mid-call functions. Everything the agent needs (rubric, services.md, localities, pricing line, decline lines, angry-caller script, today's date) must live in the Vaani dashboard. | ✅ design · ⚠️ add date + anger block |
| Agent created in Vaani on deploy | `scripts/sync-agent.ts` runs after each deploy (GitHub Action): **create if missing, else PATCH** persona, training, experience and analysis. The prompt is never hand-edited. | ⬜ build |
| Prompt must cover: qualify/disqualify, questions, opening, tone, politeness, angry caller | The first five exist in PLAN §4; anger handling is missing. | ⚠️ |
| Booking: on only if Vaani books during the call | Our map has **designers confirm slots after the call** (brief: "final consultation slots stay with designers"). So **Vaani booking = OFF**, and Cal.com is used after the call (§3). | ✅ consistent |
| Test with WebRTC; ₹100 ≈ 15–18 min | Run all 20 transcripts as free text simulations first, then **5 live test calls × ~3 min** (§6). | ⬜ |
| After a call: transcript → app, Telegram (qualified), HubSpot (qualified), dashboard (all calls, with recording and transcript) | All four are in the flow. The recording plays through our proxy route, because Vaani's stream endpoint needs the API key. | ⬜ build |
| The evaluator sees dashboard rows only | The dashboard needs an **evaluator view**: read-only, phone numbers masked, transcript and recording visible. | ⚠️ add |
| Keep HubSpot for the founder's pipeline | Qualified lead → HubSpot contact + deal in an "Aangan Enquiries" pipeline, with amount defaulting to ₹11L. | ⬜ build |

---

## 3. Integrations: role, timing and gotchas

| Tool | Role | When | How (key API) | Gotchas |
|---|---|---|---|---|
| **Vaani** | Voice agent | During the call | `X-API-Key`; `PATCH /api/agent/{id}/persona \| training \| experience \| analysis`; webhook `call_postprocessing`; `GET /api/call-history`, `/api/call_details/…`, `/api/stream/{call_id}` | It isn't confirmed that WebRTC test calls fire the webhook, so a **poll backup** runs every 5 min. Marathi needs a test. The `call_duration` unit is inconsistent between events. |
| **Neon** | System of record: every call, verdict, claim, cost | Always | `@neondatabase/serverless` over HTTP, using the Vercel integration's `DATABASE_URL` | Scales to zero after 5 min idle and **wakes on the next query** (no pause like Supabase). Free tier: 1 GB, 100 CU-hours a month. `pg_trgm` handles fuzzy locality matching. |
| **HubSpot** | Founder's sales pipeline and forecast | After the verdict (qualified only), then each stage change | Private-app token. Contact upsert via `POST /crm/v3/objects/contacts/search` (by phone), then create; `POST /crm/v3/objects/deals` with an association to the contact; a note carries the call summary and dashboard link. | Create the pipeline and its custom properties once via a setup script. Never send the transcript, only the summary and link. |
| **Cal.com** | The real consultation booking, **after a designer claims** | After the call | `Authorization: Bearer`, `cal-api-version` header. Get availability for the designer's event type, then `POST /v2/bookings`; webhook `BOOKING_CREATED / RESCHEDULED / CANCELLED` | It needs an attendee email. If the caller gave none, book with the studio records address and put the caller's phone in `location`; the designer confirms by phone. Pin the API version headers when building. |
| **Telegram** | Instant push to designers, plus alerts | After the verdict; on claim; on SLA; on breakage | `sendMessage` with an inline keyboard; webhook with `X-Telegram-Bot-Api-Secret-Token` | Group privacy mode; check the tapper is in the designers table |
| **Resend** | Email: team copy of each handoff, caller confirmation after booking, founder daily digest, breakage alerts | After the verdict, after booking, daily | `POST /emails` | Without a **verified domain**, Resend only sends to your own account address (403 otherwise). Verify a domain, or limit test sends to yourself. |
| **GitHub** | Repo, CI, schedules | Every push; every 5 min; daily | Actions: CI (typecheck, unit tests, **text eval with a "0 price figures" gate**); a 5-min schedule for SLA checks, the Vaani poll and health checks; a daily 00:05 IST job for the prompt date and digest; a post-deploy agent sync | Scheduled Actions can run late under load. The SLA unit is 15 min, so that's acceptable. Vercel Hobby cron only runs daily, which is why GitHub runs these jobs. |
| **Vercel** | Hosting | — | Next.js App Router; env vars per environment | Webhook routes run on the Node runtime; keep them under 10s and acknowledge fast |

### HubSpot features by stage

| Stage | Useful HubSpot features | Why |
|---|---|---|
| **Now (assignment, free CRM)** | Contacts; Deals with one custom pipeline (*Qualified → Claimed → Consultation booked → Consultation done → Proposal sent → Won / Lost*) and stage probabilities; deal amount (₹11L default); deal owner = designer; custom properties (locality, scope, criteria, source, dashboard link); notes; tasks for nurture follow-ups | Gives Nikhil a pipeline board and a weighted forecast without a raw table |
| **Pilot (paid Sales Hub)** | Forecasting tool, sales reporting dashboards, meeting links, the designers' mobile app, sequences for nurture follow-ups | Revenue forecast by month; designers live in one app |
| **Scale** | Marketing Hub source attribution (Instagram, LinkedIn, Google ads → signed projects); forms (web-form channel); WhatsApp inbox; Service Hub tickets for complaints like T09 | Spend goes where signed projects come from; complaints get an SLA of their own |

*Check which of the pilot and scale features your HubSpot tier includes before promising them to Nikhil.*

---

## 4. Criteria check

✅ covered · ⚠️ partly covered, fix listed · ⬜ planned, not built yet

### Earns marks

| Criterion | How it shows up here | Status |
|---|---|---|
| **Think beyond the brief** (user's mindset) | Each person gets something they didn't ask for. The **caller** gets a "what happens next" close and a confirmation email after booking. The **designer** gets a *first-call prep* block in the note (likes and dislikes, constraints, what not to re-ask). A **frustrated repeat caller** (T16) gets an apology and goes to a senior person. **Nikhil** gets a daily digest. | ⚠️ add the prep block and digest |
| **Flexibility layer** | Timeline fail (T07): "Could you be flexible on the finish date? By how much?" If it moves past 6 weeks, the caller qualifies; if not, nurture. Volunteered low budget (T10): offer a smaller scope ("Would starting with just the kitchen work?") **without naming any figure**. | ⚠️ add to prompt |
| **Who each option suits** | The note carries "Good fit because … / Watch for …". Declines name the real reason (area, advice only, type). Leads route by segment (residential vs commercial designers). | ⚠️ add the fit lines |
| **Voting, organizer decides** | Designers tap **Claim** or **Pass + reason** (*Too busy / Not my speciality / Location*). Nikhil sees all passes on the lead page and can **reassign**. | ⚠️ add reasons + reassign |
| **Likes and dislikes in one question** | The agent asks once: "Anything you'd love in the design, or anything you want to avoid?" It's extracted into `likes` and `dislikes`, and the caller's own words are kept. | ⚠️ add to prompt and extraction |
| **Constraints that actually work** (the area check is our "commute") | **In the call:** the locality list sits in the prompt. **After the call:** spelling-tolerant matching (aliases + `pg_trgm`) is the final word. If the agent and the backend disagree, it's flagged. Talegaon, Lonavala, Nashik and Mumbai **must be declined end-to-end**; they're test cases. | ⬜ build + test |
| **Option design** | Telegram: 2 buttons (Claim / Pass). The slot picker shows **at most 3** times matching the caller's windows. The agent asks one question at a time and gives the caller 2 choices where possible ("site visit or studio?"). | ✅ design |
| **Attention to detail** | Pricing line verbatim; T14 note; T17 merge; T18 hold; T20 late start is a flag, not a fail; open questions are logged, not decided. | ✅ |
| **Good components map** | Rebuilt with the six labels and the right items in each (see `aangan-call-flow` v2). | ✅ fixed today |

### Loses marks: guards

| Risk | Guard | Status |
|---|---|---|
| Features that exist but don't work | **Cut from the build:** Exotel, the studio SIM, WhatsApp and invoice-based cost. They stay in the README as next steps. Everything built is covered by a test in §6. | ✅ decided |
| App breaks (database paused) | Neon instead of Supabase; `/api/health` checks Neon, Vaani, HubSpot, Telegram and Resend; the 5-min GitHub job **alerts on Telegram and by email** on failure | ⬜ build |
| Front end with nothing behind it | Every dashboard number comes from a Neon view. No hardcoded demo numbers. Empty states say "No calls yet". | ⬜ build |
| Spelling mistakes and ambiguous input | See the ambiguity table below | ⚠️ add |
| Filters collected but ignored | Every field the agent extracts appears in **all three** places: Telegram note, HubSpot deal properties and the dashboard. A test checks each field reaches each one. Dashboard filters live in the URL and are tested. | ⬜ build + test |
| No way to restart | **Voice:** "Can we start over?" makes the agent reset and re-ask. **Dashboard:** "Clear filters" on every list. **Founder only:** "Archive test calls" hides test rows without deleting them. | ⚠️ add |
| Map too complex or meaningless | v2 map: two rows × six labels, one line each | ✅ |

### Ambiguous input handling

| Input | Handling |
|---|---|
| Locality spellings (Hinjawadi / Hinjewadi, Pimpri-Chinchwad / PCMC, "Viman nagar side", Kharadi) | Alias list + trigram match. Unlisted → the agent asks once, "Is that within Pune city or PCMC?" |
| Relative dates ("before Diwali", "next month", "after possession") | The agent asks for a month and records the caller's exact words. The verdict converts them using the date line in the prompt (Diwali is 8 Nov 2026). |
| Spoken phone numbers ("double eight", Hindi or Marathi digits) | Normalised to E.164, then read back once: "That's 98 xxxx xx47, right?" |
| Spoken emails ("at the rate", "dot com") | Normalised, then spelled back. If it's still invalid → no email; the designer confirms by phone. |
| Size as BHK only | Recorded as BHK; sq ft left unknown (never guessed) |
| Mixed language (Hinglish, Marathi-English) | Vaani auto-detect; handoff notes always in English |

---

## 5. Prompt additions (closed-bubble checklist)

These go into `/agent/blocks` and are pushed by `sync-agent`:

1. **Today's date** (refreshed daily): "Today is Saturday, 10 October 2026. Studio hours are 10am–7pm IST." With this, the agent can do "under 6 weeks" maths.
2. **Angry or frustrated caller:**
   - Let them finish.
   - Acknowledge it in one sentence ("I'm sorry. That's not the experience we want you to have.").
   - Don't argue, explain away or blame anyone.
   - Don't promise outcomes or times you can't guarantee.
   - Offer to have a senior person call back, and take their preferred time.
   - If they're abusive, stay calm, say you'll pass the message on, and close politely.
3. **Flexibility questions** (timeline, scope) as in §4.
4. **The likes and dislikes question.**
5. **Start over:** "Of course. Let's start fresh." Clear what's been collected and begin again at the scope question.
6. **Callback number** (WebRTC has no caller ID): ask for it, then read it back once.
7. **Optional email,** only once a consultation is requested: "Would you like the confirmation by email?"

---

## 6. Test plan (inside the ₹100 budget)

| Step | What | Cost |
|---|---|---|
| 1 | Unit tests: routing rules, area matching (incl. misspellings and Talegaon / Lonavala), phone and email normalisers, price checker | Free |
| 2 | Text simulation of **T01–T20** against the same prompt; report accuracy and the count of price figures spoken (must be **0**) | LLM tokens only |
| 3 | Pipeline replay: post each transcript to the webhook → check the Neon row, Telegram, HubSpot deal (qualified only) and dashboard row | Free |
| 4 | **Live WebRTC calls, ~3 min each:** T01 (English, qualified) → T19 (restaurant decline) → T14 (Hindi proxy caller) → T07 (Diwali, flexibility → nurture) → T09-style angry caller (Marathi) | ~15 min ≈ ₹83 |
| 5 | Check the dashboard rows for all 5 calls, with recording and transcript | Free |

---

## 7. Build order for today

| Block | Work | Done when |
|---|---|---|
| 1 | Repo + Next.js + Neon schema + `.env.example` + health route | `/api/health` is green |
| 2 | `sync-agent` + prompt blocks → agent visible in Vaani | Agent appears under Agents with the right prompt, voice and languages |
| 3 | Vaani webhook + poll backup → Neon (all calls) | A replayed transcript creates one row, even if sent twice |
| 4 | Verdict + routing + price guard + area matching | 20-transcript text eval passes |
| 5 | Telegram card + Claim / Pass + HubSpot deal | Qualified replay → card + deal |
| 6 | Dashboard (overview, calls list with recording and transcript, lead page, evaluator view) | Rows show for all replays |
| 7 | Cal.com slot picker after claim + Resend emails | Claim → slot → booking → email |
| 8 | GitHub Actions (CI, 5-min job, daily date sync) + README + map | CI green, alert tested by breaking `DATABASE_URL` once |
| 9 | 5 live WebRTC calls → fixes → submit | Evaluator view shows the 5 rows |

---

## 8. What I need from you to start

1. **Vaani:** API key, plus your agent ID if the platform already created one.
2. **Neon:** connection string, or connect Neon through the Vercel integration.
3. **HubSpot:** a private-app token with contacts and deals read/write.
4. **Cal.com:** API key and one event type ("Aangan consultation", 45 min) per test designer.
5. **Resend:** API key, and a verified sending domain if emails should reach anyone but you.
6. **Telegram:** bot token and the designers' group chat ID.
7. **GitHub repo + Vercel project:** linked to each other.
8. **Confirm** Vaani booking stays OFF (designers confirm slots after the call).
