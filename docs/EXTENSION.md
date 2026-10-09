# Extension note: WhatsApp and the web form

**The idea:** the same `enquiries` table, the same five-criteria verdict, and the same Telegram + HubSpot handoff. Only the trigger and the input change.

## Why the other channels need it

| Case | What happened | What this pipeline would have done |
|---|---|---|
| **W01** | A 4BHK referral messaged at 7:14pm. Nobody replied until 11:47am the next day, after the caller chased at 9:32am. | Answered at 7:14pm, qualified, and on a designer's phone within minutes. |
| **W05** | A Baner 2BHK messaged on Saturday evening. The reply came Monday, and the lead went cold after two follow-ups. | Answered on Saturday. The same 1-hour window that converts at 4× applies. |
| **F04, F07** | Price-only form submissions: "I want to know the cost", "email me the price list". There was no project detail and, for F07, no phone number. | The same pricing line, then one question about the project, never a number. A lead with no project detail becomes **nurture** instead of being dropped. |

## What changes

| | Phone (built) | WhatsApp | Web form |
|---|---|---|---|
| Trigger | Vaani call → webhook | WhatsApp Business API webhook (or Vaani's native WhatsApp integration) | Form POST → `/api/forms/submit` |
| Input | Transcript + extracted fields | Message thread (text and photos) | Structured fields |
| Context | Same rubric, locality list, history by phone hash | Same | Same, plus matching by email |
| Processing | `processCall()` | `processThread()`: thread → `Turn[]` → the same `ruleVerdict()` | Fields → `Turn[]` (one "caller" turn) → the same `ruleVerdict()` |
| AI | Vaani agent in the call; optional model after | A WhatsApp agent replies 24/7 using the same `agent/blocks.ts` text | None needed: forms are already structured |
| Output | Same routing | Same routing | Same routing |

## Changes needed

1. **Data model:** `enquiries.channel` already accepts `whatsapp` and `web_form`. Add a `messages` table next to `calls`, linked to the enquiry.
2. **Webhooks:** `/api/whatsapp/webhook` (verify the Meta `X-Hub-Signature-256`) and `/api/forms/submit` (with spam protection).
3. **Grouping:** match by phone hash, and by email for forms. A form followed by a call becomes one enquiry, so a lead never appears twice.
4. **Card label:** the Telegram card already shows the channel ("WhatsApp · 20 Sep, 6:44pm").
5. **The pricing rule still holds:** WhatsApp replies come from the same `PRICE_LINE`, and the price guard runs on every agent message.
