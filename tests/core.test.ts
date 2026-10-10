import { test } from "node:test";
import assert from "node:assert/strict";
import { matchArea } from "../lib/localities";
import { normalizePhone, normalizeEmail, redact } from "../lib/normalize";
import { findPriceFigures } from "../lib/priceGuard";
import { mergeTarget, previouslyDropped } from "../lib/history";
import { parseTranscript } from "../lib/transcript";
import { ruleVerdict } from "../lib/verdict";
import { PRICE_LINE, PRICE_GUIDE } from "../agent/blocks";

test("area: listed, misspelt, not served, to confirm", () => {
  assert.equal(matchArea("We have a flat in Hinjawadi phase 2").locality, "Hinjewadi");
  assert.equal(matchArea("flat in kothrood").status, "in");          // misspelt
  assert.equal(matchArea("its in Pimpri Chinchwad").status, "in");
  assert.equal(matchArea("our bungalow is in Talegaon Dabhade").status, "out");
  assert.equal(matchArea("weekend home in Lonavla").status, "out");  // misspelt, still excluded
  assert.equal(matchArea("I'm in Nashik").status, "out");
  assert.equal(matchArea("1BHK in Kharadi").status, "confirm");
  assert.equal(matchArea("somewhere near the station").status, "unclear");
});

test("phone and email normalisers", () => {
  assert.equal(normalizePhone("double eight four six one zero zero eight eight zero zero"), null); // 11 digits: rejected, not guessed
  assert.equal(normalizePhone("eight four six one double zero eight eight zero zero"), "+918461008800");
  assert.equal(normalizePhone("+91 84610 08800"), "+918461008800");
  assert.equal(normalizePhone("८४६१००८८००"), "+918461008800");
  assert.equal(normalizeEmail("priya dot joshi at the rate gmail dot com"), "priya.joshi@gmail.com");
  assert.equal(normalizeEmail("priya at gmail"), null);
  assert.equal(redact("call me on 98765 43210 or a@b.com"), "call me on [PHONE] or [EMAIL]");
});

test("price guard: approved indicative ranges pass, any other figure fails", () => {
  for (const line of Object.values(PRICE_LINE)) assert.equal(findPriceFigures([{ role: "agent", text: line }]).length, 0, line);
  for (const band of Object.values(PRICE_GUIDE)) assert.equal(findPriceFigures([{ role: "agent", text: `As a guide, ${band}.` }]).length, 0, band);
  assert.ok(findPriceFigures([{ role: "agent", text: "Usually ₹1,500 to ₹2,000 per sq ft" }]).length > 0); // not an approved band
  assert.ok(findPriceFigures([{ role: "agent", text: "So your 1,400 sq ft home would be about ₹28 lakh" }]).length > 0); // a total
  assert.ok(findPriceFigures([{ role: "agent", text: "We can give you a 10% discount" }]).length > 0);
  assert.equal(findPriceFigures([{ role: "agent", text: "It's about 1,400 sq ft, lovely." }]).length, 0);
  assert.ok(findPriceFigures([{ role: "agent", text: "For a 2BHK it's typically 8 lakh" }]).length > 0);
  assert.ok(findPriceFigures([{ role: "agent", text: "Our rates start at ₹1,800 per sq ft" }]).length > 0);
  assert.ok(findPriceFigures([{ role: "agent", text: "यह लगभग 5 लाख होगा" }]).length > 0);
  assert.equal(findPriceFigures([{ role: "caller", text: "my budget is 2 lakh" }]).length, 0); // caller may say numbers
});

test("repeat callers: merge within 30 min, flag dropped enquiries", () => {
  const now = new Date("2026-09-22T14:16:00+05:30");
  assert.equal(mergeTarget([{ id: "a", status: "incomplete", created_at: "2026-09-22T14:14:00+05:30", last_call_ended_at: "2026-09-22T14:15:12+05:30", handed_off: false, claimed: false }], now), "a");
  assert.equal(mergeTarget([{ id: "a", status: "qualified", created_at: "2026-09-22T12:00:00+05:30", last_call_ended_at: "2026-09-22T12:05:00+05:30", handed_off: true, claimed: true }], now), null);
  assert.equal(previouslyDropped([{ id: "m", status: "new", created_at: "2026-09-15T15:00:00+05:30", last_call_ended_at: null, handed_off: false, claimed: false }], now), true);
});

test("flexibility: timeline fail + later start = nurture, not decline", () => {
  const t = parseTranscript("AGENT: Hello\nUSER: I want my kitchen and living room redone in 3 weeks before guests arrive, it's in Baner.\nAGENT: That's too soon.\nUSER: Okay, I can be flexible, what if I start after that?");
  const v = ruleVerdict(t, { callDate: new Date("2026-10-10") });
  assert.equal(v.outcome, "nurture");
});

test("start over / two fails -> declined with both criteria", () => {
  const t = parseTranscript("USER: I just want some ideas for my living room in Mumbai.");
  const v = ruleVerdict(t, { callDate: new Date("2026-10-10") });
  assert.equal(v.outcome, "declined");
  assert.deepEqual(v.declineCriteria.sort(), ["real_project", "service_area"]);
});

test("ordinary words never become places", () => {
  assert.equal(matchArea("What if I start after Diwali?").status, "unclear");
  assert.equal(matchArea("put a banner up").status, "unclear");
});

import { slaLevel, slaStart } from "../lib/sla";
test("SLA: in-hours escalates at 15/30/60; after-hours waits for 10am", () => {
  const sent = new Date("2026-10-12T11:00:00+05:30");
  assert.equal(slaLevel(sent, new Date("2026-10-12T11:16:00+05:30")), 1);
  assert.equal(slaLevel(sent, new Date("2026-10-12T11:31:00+05:30")), 2);
  assert.equal(slaLevel(sent, new Date("2026-10-12T12:01:00+05:30")), 3);
  const night = new Date("2026-10-12T22:47:00+05:30");
  assert.equal(slaStart(night).toISOString(), new Date("2026-10-13T10:00:00+05:30").toISOString());
  assert.equal(slaLevel(night, new Date("2026-10-13T02:00:00+05:30")), 0);
});
