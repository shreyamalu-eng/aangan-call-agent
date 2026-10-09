# Aangan Studio: inbound call agent

Every enquiry call to Aangan Studio is answered by a Vaani voice agent and checked against Nikhil's five criteria. Qualified leads reach the designers on Telegram with every intake question already asked, and land in HubSpot as deals. Every call, qualified or not, shows up on the dashboard with its recording and transcript.

**Stack:**

| Part | Tool |
|---|---|
| Voice agent | Vaani |
| Hosting and dashboard | Next.js 15 on Vercel |
| Database | Neon Postgres |
| Designer handoff | Telegram bot |
| Sales pipeline | HubSpot CRM |
| Booking after the call | Cal.com |
| Email | Resend |
| CI and the 5-minute job | GitHub Actions |

## How a call flows

The full map is in `docs/COMPONENTS.md` (Trigger → Input → Context → Processing → AI → Output).

1. **During the call, inside Vaani.** The call is a closed bubble: nothing from our app reaches it.
   - Everything the agent knows comes from `agent/blocks.ts`, which is pushed to Vaani on every deploy and every night. That covers the prompt, the disclosure greeting, the pricing line, the FAQ, guardrails and the fields to extract.
   - The nightly push refreshes the prompt's "Today is …" line, so timeline checks work.
2. **After the call.** Vaani posts `call_postprocessing` to `/api/vaani/webhook`; a 5-minute poll is the backup. The backend then:
   - verifies the signature, then logs the call (once only, however many times Vaani retries)
   - moves name, phone and email into `people`
   - masks phone and email in the transcript
   - runs the price check
   - runs the five-criteria rules (`lib/verdict.ts`). An optional model only fills criteria the rules leave unclear.
   - routes the lead in code: qualified → Telegram + HubSpot + email copy; complaint → page Nikhil; nurture → follow-up date; declined → logged only.
3. **Designer loop.** A designer taps **Claim** in Telegram. The bot then offers at most 3 open Cal.com times that fit the caller's own preferred windows. Tapping one:
   - books it in Cal.com
   - moves the HubSpot deal to "Consultation booked"
   - emails the caller, if they gave an email
4. **SLA.** Unclaimed after 15 min → front desk lead; after 30 min → Nikhil; after 60 min → marked breached. For after-hours leads the clock starts at 10am.

**Vaani's booking integration stays off.** Designers confirm slots after the call: the brief keeps final slots with designers, and the assignment says to enable it only if Vaani books during the call.

## Setup (about 20 minutes)

1. **Neon:** in the project, open **Connect**, then copy the pooled connection string.
2. **Telegram:** create a bot with @BotFather and add it to the designers' group. To get the group's chat ID, send a message in the group, then open `https://api.telegram.org/bot<TOKEN>/getUpdates`.
3. **HubSpot:** create the service key (see the scopes in `lib/hubspot.ts`). Optionally create the pipeline *Aangan Enquiries* with these stages: Qualified → Claimed → Consultation booked → Consultation done → Proposal sent → Won / Lost. Put its pipeline and stage IDs in env.
4. **Vercel:** import this GitHub repo and add every variable from `.env.example`. Set `APP_URL` to the production URL.
5. **GitHub → Settings → Secrets → Actions:** add `APP_URL`, `CRON_SECRET` and `DATABASE_URL`.
6. **Deploy.** The *After each Vercel deploy* workflow runs the migrations, **creates the agent in Vaani**, pushes its config and sets the Telegram webhook. Copy the `agentId` it prints into Vercel as `VAANI_AGENT_ID`.
7. **Vaani dashboard** (these settings can't be changed through the API):
   - **Agents → Aangan Studio Enquiries:** upload `agent/knowledge/services.md` to the knowledge base (never `pricing.md`), and choose the voice.
   - **Settings → Webhooks:** set `https://<APP_URL>/api/vaani/webhook`. If Vaani shows a signing secret, put it in `VAANI_WEBHOOK_SECRET`.
   - **Actions → Integrations → Booking appointment:** leave it OFF.
8. **Test:** use **Start test** (WebRTC) in Vaani. You can also replay any September transcript from **Settings → Replay**, which costs no Vaani minutes.

**Local commands:** `npm i`, `npm test`, `npm run eval`, `npm run dev`, `npm run db:migrate`.

To run everything offline against an embedded Postgres:
```
TEST_PGLITE=1 TEST_PGLITE_DIR=.pglite npx tsx scripts/local-e2e.ts
```

## Results (rules engine on the raw September transcripts)

`npm run eval` scores **19/19** of the scorable cases. T08 is a missed call with no transcript, and is now answered by the agent. The full table is in `eval/report.md`.

**Price figures:** the price guard found **2 in the human front desk's own lines**. In T10 they repeated "1 to 1.5 lakh", and in T13 they said "3× the cost". Both are exactly what the agent is told never to say, and the guard catches them. The agent's own target is 0, and it's measured on every live call (dashboard KPI "Price figures spoken").

**Not measured:** live voice accuracy, Hindi and Marathi speech recognition, and how the agent actually behaves on a call. These need real Vaani calls. The test budget is about 15 minutes, so the plan is:

| Test call | What it checks |
|---|---|
| T01 | English, qualified |
| T19 | Restaurant decline |
| T14 | Hindi, parents decide |
| T07 | Diwali timeline, flexibility question → nurture |
| T09-style | Angry existing client, in Marathi |

## Reliability

- **Neon** scales to zero after 5 idle minutes and wakes on the next query. It doesn't pause like Supabase.
- **`/api/health`** checks Neon on each load. The 5-minute job also checks Vaani, HubSpot, Cal.com, Resend and Telegram.
- **Alerts:** on the first failure, an alert goes to Telegram and email, plus a "healthy again" message on recovery. The GitHub job also fails (and GitHub emails you) if the app itself is down.
- **Logging:** every call gets a row before anything else runs. A failure in one provider records an error on the call but never loses it.
- **Provider emails:** read the ones from Neon, Vercel, Vaani and Resend about limits and paused services.

## Privacy

- **Where personal data lives:** names, phone numbers and emails are only in `people`. Transcripts store masked text, and the verdict model never sees a phone number.
- **Evaluator view:** it needs no login and masks phone numbers. Signed-in staff see full details.
- **Secrets:** all keys are Vercel/GitHub secrets; `.env` is gitignored. **Rotate the keys that were shared in chat after submission.**

## Open questions for Nikhil (not decided silently)

1. **Commercial under 500 sq ft (T18):** `services.md` states no minimum. Such leads are held as "designer to confirm" and routed to Nikhil.
2. **Timeline floor:** under 6 weeks is a hard fail; 6–10 weeks passes with a flag.
3. **"Site available within 8–10 weeks":** read strictly, it would fail T20's January start. It's treated as a flag only.
4. **Free consultation:** the front desk says the consultation is free, but `services.md` doesn't, so the agent never says it.
5. **Site visits:** recorded as a preference, never promised.
6. **Locality list:** Kharadi, Nanded City, Bavdhan, Pashan, Wagholi, Moshi and Bhosari are marked "to confirm" (`lib/localities.ts`).
7. **Overnight escalations:** they wait for 10am; complaints page immediately. Confirm this.
8. **After-hours complaint callback:** confirm what the agent may promise.
9. **On-call contact:** who is senior/on-call for complaints?
10. **Phone number on the Telegram card:** it's left off, and designers see it after claiming. Confirm this.

## Known limits

- **Not confirmed in Vaani's docs:**
  - the per-call cost field (cost = minutes × the rate in Settings)
  - whether agent webhooks are signed (verified when a secret is set)
  - Marathi speech support
  - the warm-transfer configuration
- **`npm audit`:** it reports build-time PostCSS and sharp advisories that need Next 16. The app processes no untrusted CSS or images.
