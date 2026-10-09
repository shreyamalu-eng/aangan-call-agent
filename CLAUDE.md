# Instructions for Claude Code (read this first)

The user, Shreya, is a beginner. Act as her CTO and do the work yourself.

## How to talk to her
- Use plain, short sentences. No jargon. One thing at a time.
- Only stop when she has to do something herself: sign in, click a button in a browser, or paste a key. Then tell her exactly what to click, in 1–3 short lines. Use `open <url>` to open the right page for her.
- Never print, log or commit secrets. `.env` already holds her Vaani, HubSpot, Cal.com and Resend keys. Read it with tools; don't echo it.
- After each step, say in one line what you finished.

## The job
This folder is a finished Next.js app (see README.md). Set it up end to end:

1. `npm install`, `npm test`, `npm run eval` (all must pass). Delete `aangan-call-agent.tar.gz` (leftover).
2. **GitHub.** The remote `origin` is https://github.com/shreyamalu-eng/aangan-call-agent.git. An earlier push was rejected: "refusing to allow an OAuth App to create or update workflow … without workflow scope". Fix the login: install `gh` with Homebrew if missing, then run `gh auth login --hostname github.com --git-protocol https --web --scopes workflow,repo` and `gh auth setup-git`. Then push `main`.
3. **Neon.** Project `lingering-cherry-26932740`, branch `production`. Use the Neon CLI (`npm i -g neon@latest`, `neon login`), or the console Connect dialog, to get the *pooled* connection string. Put it in `.env` as `DATABASE_URL`. Run `npm run db:migrate`. Do NOT create any public storage bucket (ignore any `neon.ts` bucket config).
4. **Telegram.** Walk her through @BotFather (`open https://t.me/BotFather`): `/newbot`, name "Aangan Leads". She pastes the token into `.env` as `TELEGRAM_BOT_TOKEN` herself. Have her create a group "Aangan Designers", add the bot, and send one message. Then call `getUpdates` to read the group chat ID into `TELEGRAM_DESIGNERS_CHAT_ID`.
5. **Fill the rest of `.env`.** Generate random values for `CRON_SECRET`, `DASHBOARD_PASSWORD` (readable, e.g. three words), `PHONE_PEPPER` and `TELEGRAM_WEBHOOK_SECRET`. Set `TEAM_EMAIL` and `FOUNDER_EMAIL` to her Resend account email (ask for it; Resend's test sender only delivers there). Leave the HubSpot pipeline and stage IDs empty; the built-in pipeline is used.
6. **Vercel.** `npm i -g vercel`, `vercel login` (she clicks in the browser), `vercel link` (new project "aangan-call-agent", connected to the GitHub repo). Add every non-empty `.env` value to Production with `vercel env add`. Deploy with `vercel --prod`. Set `APP_URL` to the production URL (no trailing slash), then redeploy.
7. **GitHub Actions secrets:** `gh secret set APP_URL`, `CRON_SECRET`, `DATABASE_URL` (values from `.env`).
8. **Create the Vaani agent:** `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/admin/sync-agent`. Put the returned `agentId` into Vercel as `VAANI_AGENT_ID` and redeploy. If Vaani returns an error, read docs.vaanivoice.ai and fix `lib/vaani.ts` or `agent/blocks.ts`, commit and push.
9. **Vaani dashboard (she clicks; you guide):** `open https://app.vaanivoice.ai/`. Then:
   - Agents → "Aangan Studio Enquiries": upload `agent/knowledge/services.md` to the knowledge base (NEVER `pricing.md`), and pick a warm Indian-English female voice.
   - Settings → Webhooks: `$APP_URL/api/vaani/webhook`. If it shows a signing secret, add it as `VAANI_WEBHOOK_SECRET` in Vercel and redeploy.
   - Actions → Integrations → Booking appointment: leave it OFF.
10. **Test without spending Vaani minutes:** `curl -X POST -H "Authorization: Bearer $CRON_SECRET" -H "content-type: application/json" -d '{"caseId":"T01"}' $APP_URL/api/admin/replay`. Check:
    - a dashboard row appears
    - a Telegram card arrives
    - a HubSpot deal is created
    - `$APP_URL/health` is green

    Fix anything that breaks (read Vercel logs with `vercel logs`), then commit and push. Repeat with T19 and T14.
11. **Finish:** give her, in 4 short lines: the dashboard link, the dashboard password, "make a test call from Vaani → Start test", and "tell Claude in the chat when done". Remind her to rotate the keys after submission.

## Rules that must not change
- The agent never states prices. The only allowed answer is `PRICE_LINE` in `agent/blocks.ts`.
- Vaani's in-call booking stays OFF. Designers pick slots after the call (Telegram → Cal.com).
- Personal data (name, phone, email) stays only in the `people` table.
