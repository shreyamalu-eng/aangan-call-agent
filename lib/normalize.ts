/** Normalisers for things callers say aloud. Each returns null rather than guessing. */

const WORD_DIGITS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  // Hindi / Marathi (romanised)
  shunya: "0", ek: "1", do: "2", teen: "3", char: "4", chaar: "4", paanch: "5", panch: "5", chhe: "6", che: "6", saat: "7", aath: "8", nau: "9",
  don: "2", tin: "3", sahā: "6", saha: "6", sat: "7", ath: "8", nav: "9",
};
const DEVANAGARI = "०१२३४५६७८९";

/** "double eight four six one ..." / "८४६१..." / "+91 84610 08800" -> "+918461008800" (Indian mobiles only). */
export function normalizePhone(spoken: string | null | undefined): string | null {
  if (!spoken) return null;
  let s = spoken.toLowerCase().replace(/[०-९]/g, (d) => String(DEVANAGARI.indexOf(d)));
  const tokens = s.split(/[\s,.-]+/).filter(Boolean);
  let digits = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const mult = t === "double" ? 2 : t === "triple" ? 3 : 0;
    if (mult && i + 1 < tokens.length) {
      const next = tokens[i + 1];
      const d = /^\d$/.test(next) ? next : WORD_DIGITS[next];
      if (d) { digits += d.repeat(mult); i++; continue; }
    }
    if (/^\+?\d+$/.test(t)) digits += t.replace("+", "");
    else if (WORD_DIGITS[t]) digits += WORD_DIGITS[t];
  }
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  return null;
}

/** "priya dot joshi at the rate gmail dot com" -> "priya.joshi@gmail.com" */
export function normalizeEmail(spoken: string | null | undefined): string | null {
  if (!spoken) return null;
  let s = ` ${spoken.toLowerCase()} `
    .replace(/\s(at the rate( of)?|at)\s/g, "@")
    .replace(/\s(dot|period|point)\s/g, ".")
    .replace(/\s(underscore)\s/g, "_")
    .replace(/\s(dash|hyphen)\s/g, "-")
    .replace(/\s+/g, "");
  s = s.replace(/@(gmail|yahoo|outlook|hotmail|icloud|rediffmail)(com|in|co\.in)$/, (_m, d, t) => `@${d}.${t}`);
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : null;
}

export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const d = e164.replace(/\D/g, "");
  return `+91 ••••• •${d.slice(-4)}`;
}

/** Replaces phone numbers and emails in free text so transcripts and the verdict model never carry them. */
export function redact(text: string): string {
  return text
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[EMAIL]")
    .replace(/(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, "[PHONE]")
    .replace(/\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[PHONE]");
}
