/**
 * Nikhil's five-criteria rubric (qualified.md), implemented as pass/fail rules.
 * The LLM (if configured) only fills criteria the rules leave unclear. Routing is always code.
 */
import { matchArea, type AreaMatch } from "./localities";
import { agentText, allText, callerText, type Turn } from "./transcript";
import { findPriceFigures, type PriceHit } from "./priceGuard";

export type CriterionResult = "pass" | "fail" | "unclear" | "not_mentioned";
export type Criteria = Record<"real_project" | "service_area" | "timeline" | "budget" | "decision_maker", { result: CriterionResult; evidence: string }>;
export type Outcome = "qualified" | "declined" | "nurture" | "complaint" | "non_enquiry" | "hold_designer_confirm" | "incomplete";

export type Verdict = {
  outcome: Outcome;
  criteria: Criteria;
  declineCriteria: string[];
  priority: "normal" | "previously_dropped" | "urgent";
  flags: string[];
  segment: "residential" | "commercial" | "out_of_scope" | "unknown";
  outOfScopeReason: string | null;
  area: AreaMatch;
  fields: {
    locality: string | null; property: string | null; size: string | null; scope: string | null;
    timeline: string | null; decision: string | null; source: string | null; likes: string | null;
    dislikes: string | null; preferredSlots: string | null; ownership: string | null;
  };
  noteForDesigner: string;
  fitReasons: string[];
  watchOuts: string[];
  followUpAt: string | null;
  priceHits: PriceHit[];
  engine: string;
};

export const DIWALI_2026 = "2026-11-08";
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const toNum = (s: string) => (/^\d+(\.\d+)?$/.test(s) ? Number(s) : NUM[s.toLowerCase()] ?? NaN);
const weeksBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / (7 * 864e5);

function firstSentenceMatching(text: string, re: RegExp): string | null {
  const s = text.split(/(?<=[.?!])\s+|\n/).find((x) => re.test(x));
  return s ? s.trim().replace(/^(hi|hello|hey|namaste|good (morning|afternoon|evening))[\s,.!—–-]*/i, "").replace(/^./, (c) => c.toUpperCase()).slice(0, 180) : null;
}

/** Weeks until the caller's required completion date, or null if they gave no deadline. */
export function weeksToDeadline(caller: string, all: string, callDate: Date): { weeks: number | null; text: string | null } {
  // "Diwali is about three weeks away" (stated in the call) beats our own calendar maths.
  const away = all.match(/(diwali|it)\s+is\s+(about\s+|roughly\s+|around\s+)?(\w+)\s+weeks?\s+away/i);
  if (/before\s+diwali|by\s+diwali|for\s+diwali/i.test(caller)) {
    if (away && !isNaN(toNum(away[3]))) return { weeks: toNum(away[3]), text: "before Diwali" };
    return { weeks: weeksBetween(callDate, new Date(DIWALI_2026)), text: "before Diwali" };
  }
  const sentences = caller.split(/(?<=[.?!])\s+|\n/);
  for (const s of sentences) {
    if (/possession/i.test(s)) continue; // "possession in six weeks" is site availability, not a deadline
    const m = s.match(/(?:in|within|before|by|next|maximum|max)\s+(?:about\s+|the\s+next\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+weeks?/i);
    if (m && /(done|ready|complete|finish|need|want|before|guests|arriv|maximum|max|by)/i.test(s)) return { weeks: toNum(m[1]), text: s.trim().slice(0, 120) };
  }
  for (const s of sentences) {
    const m = s.toLowerCase().match(/(?:by|before|done by|ready by|complete by|move (?:back )?in by|operational by|in)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/);
    if (m && /(done|ready|complete|finish|move|operational|by|before|like)/i.test(s)) {
      const mi = MONTHS.indexOf(m[1]);
      let y = callDate.getFullYear();
      if (mi < callDate.getMonth()) y += 1;
      const end = new Date(Date.UTC(y, mi + 1, 0));
      return { weeks: weeksBetween(callDate, end), text: s.trim().slice(0, 120) };
    }
  }
  return { weeks: null, text: firstSentenceMatching(caller, /(timeline|start|january|february|march|april|month|week|flexible|no rush)/i) };
}

function countRooms(t: string): number {
  const bhk = t.match(/(\d)\s*bhk/i);
  if (/(full home|full flat|whole (flat|house|home)|complete redesign|full redesign|redo the whole|entire (flat|home)|full interiors|end-to-end)/i.test(t)) {
    return bhk ? Number(bhk[1]) + 2 : 4;
  }
  const rooms = ["kitchen", "bedroom", "living room", "dining", "wardrobe", "bathroom", "study", "home office", "balcony"];
  let n = 0;
  for (const r of rooms) if (new RegExp(r, "i").test(t)) n++;
  const both = /both bedrooms|two bedrooms|2 bedrooms/i.test(t) ? 1 : 0;
  return Math.max(1, n + both);
}

/** Largest rupee figure the CALLER volunteered as a budget, in lakh. */
export function volunteeredBudgetLakh(caller: string): number | null {
  if (!/(budget|maximum|max|spend|afford|have around|can do)/i.test(caller)) return null;
  const m = [...caller.matchAll(/(\d+(?:\.\d+)?)\s*(?:(?:to|-|–)\s*(\d+(?:\.\d+)?))?\s*(lakh|lakhs|lac|lacs|l\b|crore|cr\b)/gi)];
  if (!m.length) return null;
  let best = 0;
  for (const x of m) {
    const v = Number(x[2] ?? x[1]) * (/cr/i.test(x[3]) ? 100 : 1);
    best = Math.max(best, v);
  }
  return best;
}

export function ruleVerdict(turns: Turn[], opts: { callDate: Date; lowBudgetLakhPerRoom?: number; entities?: Record<string, any> } ): Verdict {
  const caller = callerText(turns);
  const agent = agentText(turns);
  const all = allText(turns);
  const ent = opts.entities ?? {};
  const flags: string[] = [];
  const fit: string[] = [];
  const watch: string[] = [];
  const perRoom = opts.lowBudgetLakhPerRoom ?? 2.5;

  const crit: Criteria = {
    real_project: { result: "unclear", evidence: "" },
    service_area: { result: "unclear", evidence: "" },
    timeline: { result: "not_mentioned", evidence: "" },
    budget: { result: "not_mentioned", evidence: "" },
    decision_maker: { result: "unclear", evidence: "" },
  };

  // --- Complaint (never enters the sales pipeline)
  const isComplaint = /(my designer|project has been going|hasn'?t replied|not acceptable|ongoing project|existing (client|project)|complain)/i.test(caller);

  // --- Segment and out-of-scope types (services.md)
  let segment: Verdict["segment"] = "unknown";
  let outOfScope: string | null = null;
  const oos = caller.match(/\b(restaurant|caf[eé]|hotel|bar|pub|retail|showroom|shop|store|gym|fitness centre|salon)\b/i);
  if (oos) { segment = "out_of_scope"; outOfScope = oos[1].toLowerCase(); }
  else if (/\b(office|startup|start-up|co-?working|clinic|workstations|cabin|pod)\b/i.test(caller.replace(/home office/gi, "study"))) segment = "commercial";
  else if (/\d\s*bhk|\b(bhk|flat|apartment|villa|house|home|bedroom|kitchen|living room|bungalow)\b/i.test(caller)) segment = "residential";
  if (/vastu (only|consult)/i.test(caller)) { segment = "out_of_scope"; outOfScope = "Vastu-only consultation"; }

  // --- 1. Real project
  const adviceOnly = /(just (want )?(some )?(ideas|suggestions|advice)|give us some ideas|come and (advise|give)|suggestions on colou?rs|not planning to do the full|i'?ll (do|handle) the execution( myself)?|only (want|need) (a )?consultation|second opinion|rearrange (the )?furniture)/i;
  // Early-stage interest is not a "no": it is a follow-up (W10).
  const exploring = /(just exploring|still exploring|early stage|explore options|not ready yet|still deciding)/i.test(caller);
  // A cost/price question with no project details needs a follow-up, never a designer (W02, F04, F07).
  const priceOnly = /(how much|what.{0,20}cost|the cost|price list|per sq ?ft|rate|charge|ballpark)/i.test(caller);
  const realCue = /(redesign|redo|full home|full interiors|complete redesign|end-to-end|fit ?out|kitchen|wardrobe|bedroom|living room|design the interiors|workstations|interior project|proper design|properly design|do the interiors|villa|full package|full execution)/i;
  if (outOfScope) crit.real_project = { result: "fail", evidence: `Out of scope: ${outOfScope}` };
  else if (adviceOnly.test(caller)) crit.real_project = { result: "fail", evidence: firstSentenceMatching(caller, adviceOnly) ?? "Advice only" };
  else if (realCue.test(caller)) crit.real_project = { result: "pass", evidence: firstSentenceMatching(caller, realCue) ?? "" };

  if (crit.real_project.result === "unclear") flags.push("scope_unclear");

  // --- 2. Service area (caller's words only, spelling-tolerant)
  const area = matchArea(ent.locality ? `${ent.locality}\n${caller}` : caller);
  if (area.status === "in") crit.service_area = { result: "pass", evidence: `${area.locality}${area.fuzzy ? ` (heard "${area.matchedText}")` : ""}` };
  else if (area.status === "out") crit.service_area = { result: "fail", evidence: `${area.locality} is outside Pune/PCMC` };
  else if (area.status === "confirm") { crit.service_area = { result: "pass", evidence: `${area.locality} (inside Pune/PCMC, not on the services.md list)` }; flags.push("area_to_confirm"); }
  else crit.service_area = { result: "unclear", evidence: area.locality ?? "Locality not given" };

  // --- 3. Timeline: under 6 weeks = fail; 6–10 = flag (PLAN §6 Q2); late start = flag only (Q3)
  const dl = weeksToDeadline(caller, all, opts.callDate);
  const laterStart = /(start after|after diwali|what if i start|can (we|i) start (later|after|in)|flexible|later start|push it|november start|move the date)/i.test(caller);
  if (dl.weeks !== null) {
    if (dl.weeks < 6) crit.timeline = { result: "fail", evidence: `Needs completion in ~${Math.max(0, Math.round(dl.weeks))} weeks (${dl.text})` };
    else { crit.timeline = { result: "pass", evidence: dl.text ?? `~${Math.round(dl.weeks)} weeks` }; if (dl.weeks <= 10) flags.push("timeline_6_10_weeks"); }
  } else if (dl.text) crit.timeline = { result: "pass", evidence: dl.text };
  if (/(january|february|march)\s+start|start(ing)? (execution )?(in|from) (january|february|march)/i.test(caller)) flags.push("late_execution_start");

  // --- 4. Budget: never probed; fail only if volunteered and clearly below scope
  const budget = volunteeredBudgetLakh(caller);
  if (budget !== null) {
    const rooms = countRooms(caller);
    if (budget < perRoom * rooms) crit.budget = { result: "fail", evidence: `Volunteered budget clearly below the scope described (${rooms} room${rooms > 1 ? "s" : ""})` };
    else crit.budget = { result: "pass", evidence: "Volunteered budget fits the scope" };
  }

  // --- 5. Decision-maker
  const proxy = caller.match(/for my (parents|in-?laws|mother|father|mom|dad|son|daughter|brother|sister|boss)|initial (checking|research)/i);
  const attending = /(they (would|will) (come|attend)|both (will )?(attend|come)|they'?ll decide|they would come|will be at the consultation)/i.test(caller);
  if (proxy) {
    if (attending) crit.decision_maker = { result: "pass", evidence: `Calling for ${proxy[1] ?? "family"}; they will attend and decide` };
    else { crit.decision_maker = { result: "unclear", evidence: `Calling for ${proxy[1] ?? "someone else"}; attendance not confirmed` }; flags.push("decision_unclear"); }
  } else if (/(owner|founder|myself and my husband|my husband and i|my wife and i|we both|i decide|decision-?maker|he knows we'?re calling|said to go ahead)/i.test(caller) || /yes,? i'?m the founder/i.test(caller)) {
    crit.decision_maker = { result: "pass", evidence: firstSentenceMatching(caller, /(owner|founder|husband|wife|we both|i decide|decision|go ahead)/i) ?? "Caller decides" };
  } else { crit.decision_maker = { result: "unclear", evidence: "Not confirmed on the call" }; flags.push("decision_unclear"); }

  // --- Context flags
  let priority: Verdict["priority"] = "normal";
  if (/(i'?d called|i called (on )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|earlier|last week)|said they'?d get back|nobody (called|got) back|no one called back|it'?s been (two|2|three|3) days)/i.test(caller)) {
    priority = "previously_dropped"; flags.push("previously_dropped"); watch.push("Caller was promised a callback that never happened. Apologise first.");
  }
  if (/(cut off|called just now|line dropped|got disconnected)/i.test(caller)) flags.push("callback_after_drop");
  const rented = /\brent(ed|al)?\b|lease/i.test(caller);
  if (rented) {
    if (/(no structural|don'?t break walls|reversible|no wall)/i.test(all)) { flags.push("rented_no_structural"); fit.push("Rented flat with no structural changes; landlord is fine with it."); }
    else watch.push("Rented flat: confirm no structural changes and landlord consent.");
  }
  if (/(frustrat|not a good sign|annoy|angry|this is not acceptable|ridiculous)/i.test(caller)) flags.push("frustrated");
  if (/site visit|come to (the )?site|see the site/i.test(all)) flags.push("site_visit_requested");

  // --- Fields for the handoff
  const size = caller.match(/(\d[\d,]*)\s*(sq\.?\s*ft|square feet|sqft)/i);
  const bhk = caller.match(/(\d)\s*bhk/i);
  const property = caller.match(/\b(\d\s*bhk|villa|independent house|bungalow|office|co-?working (space)?|clinic|pod|restaurant)\b/i);
  const source = /(referr|got your number from|asked me to call|friend|recommend)/i.test(caller) ? "referral"
    : /instagram/i.test(caller) ? "instagram" : /linkedin/i.test(caller) ? "linkedin" : /google/i.test(caller) ? "google" : /builder/i.test(caller) ? "builder" : null;
  const referrer = caller.match(/(?:from a friend\s*[—–-]?\s*|friend\s*[—–-]\s*|referred by\s+|got your number from\s+(?:a friend\s*[—–-]?\s*)?|^|\.\s)([A-Z][a-z]+ [A-Z][a-z]+)(?= asked me| said|\.|,| she| he)/m);
  const slots = ent.preferred_slots ?? firstSentenceMatching(caller, /(this week|next week|weekend|weekday|saturday|sunday|monday|morning|evening|after \d|early next)/i);
  const decision = crit.decision_maker.evidence || null;
  const scope = ent.scope ?? firstSentenceMatching(caller, realCue);

  // --- Routing (code, not the model)
  const fails = (Object.keys(crit) as (keyof Criteria)[]).filter((k) => crit[k].result === "fail");
  const callerWords = caller.split(/\s+/).filter(Boolean).length;
  let outcome: Outcome;
  let followUpAt: string | null = null;
  if (isComplaint) { outcome = "complaint"; priority = "urgent"; }
  else if (callerWords < 12 && crit.real_project.result !== "pass" && area.status === "unclear") outcome = "incomplete";
  else if (fails.length === 0) {
    const sqft = size ? Number(size[1].replace(/,/g, "")) : null;
    if (segment === "commercial" && sqft !== null && sqft < 500) { outcome = "hold_designer_confirm"; flags.push("commercial_under_500"); }
    else if (exploring) {
      outcome = "nurture"; flags.push("early_stage");
      followUpAt = new Date(opts.callDate.getTime() + 35 * 864e5).toISOString().slice(0, 10);
    }
    else if (crit.real_project.result === "unclear" && area.status === "unclear") {
      // Not enough to judge: the front desk asks the one missing question.
      outcome = "incomplete"; flags.push("needs_follow_up"); if (priceOnly) flags.push("price_only");
    }
    else if (crit.real_project.result === "unclear" && segment === "unknown") outcome = "non_enquiry";
    else outcome = "qualified";
  } else if (fails.length === 1 && fails[0] === "timeline" && laterStart) {
    outcome = "nurture";
    const after = /diwali/i.test(all) ? new Date(new Date(DIWALI_2026).getTime() + 2 * 864e5) : new Date(opts.callDate.getTime() + 28 * 864e5);
    followUpAt = after.toISOString().slice(0, 10);
  } else outcome = "declined";

  if (outcome === "qualified") {
    if (crit.real_project.result === "pass") fit.push(`Real project: ${crit.real_project.evidence}`);
    if (area.status === "in") fit.push(`In our area (${area.locality}).`);
    if (dl.weeks !== null && dl.weeks > 10) fit.push("Comfortable timeline.");
    if (source === "referral") fit.push("Referral: warmer lead.");
    if (flags.includes("timeline_6_10_weeks")) watch.push("Tight timeline (6–10 weeks): confirm design and execution plan at the consultation.");
    if (flags.includes("late_execution_start")) watch.push("Execution starts later than 10 weeks after consultation: plan the design phase around it.");
    if (flags.includes("area_to_confirm")) watch.push(`${area.locality} is not on the services.md list: confirm we cover it.`);
    if (flags.includes("decision_unclear")) watch.push("Decision-maker not confirmed on the call.");
    if (crit.budget.result === "not_mentioned") watch.push("Budget not mentioned (as intended; we never probe).");
  }

  const noteParts: string[] = [];
  if (proxy && attending) noteParts.push(`Decision with ${proxy[1] ?? "family"}; both attending.`);
  if (priority === "previously_dropped") noteParts.push("Priority: previously dropped. Caller frustrated — handle with care.");
  if (flags.includes("site_visit_requested")) noteParts.push("Caller would like a site visit (not promised).");
  if (flags.includes("rented_no_structural")) noteParts.push("Rented; no structural changes; landlord OK.");
  if (flags.includes("commercial_under_500")) noteParts.push("Commercial under 500 sq ft: designer to confirm (pending Nikhil).");

  return {
    outcome,
    criteria: crit,
    declineCriteria: fails,
    priority,
    flags: [...new Set(flags)],
    segment,
    outOfScopeReason: outOfScope,
    area,
    fields: {
      locality: area.locality,
      property: bhk ? `${bhk[1]}BHK` : property ? property[1].toLowerCase() : null,
      size: size ? `~${size[1]} sq ft` : null,
      scope,
      timeline: crit.timeline.evidence || null,
      decision,
      source: source ? (referrer && source === "referral" ? `referral from ${referrer[1]}` : source) : null,
      likes: ent.likes ?? null,
      dislikes: ent.dislikes ?? null,
      preferredSlots: slots ?? null,
      ownership: rented ? "rented" : /(bought|owner|own|possession|new construction)/i.test(caller) ? "owned" : null,
    },
    noteForDesigner: noteParts.join(" ") || "none",
    fitReasons: fit,
    watchOuts: watch,
    followUpAt,
    priceHits: findPriceFigures(turns),
    engine: "rules",
  };
}
