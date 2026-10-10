"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

const label = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const istNow = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 16);

/**
 * Book a consultation from the lead's page. Open Cal.com times are one click; a time agreed with the
 * caller by phone can always be recorded. Same steps as booking from Telegram.
 */
export function BookingCard({ enquiryId, slots, calError, preferred, defaultDesigner, isTest }: {
  enquiryId: string; slots: string[]; calError: string | null; preferred: string | null; defaultDesigner: string | null; isTest?: boolean;
}) {
  const router = useRouter();
  const [designer, setDesigner] = useState(defaultDesigner ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const book = async (start: string, calendar: boolean) => {
    if (!designer.trim()) { setMsg({ ok: false, text: "Enter the designer's name first." }); document.getElementById("bk-designer")?.focus(); return; }
    setBusy(start); setMsg(null);
    try {
      const r = await fetch("/api/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enquiryId, designer, start, calendar }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't book.");
      setMsg({ ok: true, text: `Booked for ${d.when}${d.calendar ? " in Cal.com" : ""}. HubSpot updated${d.emailedCaller ? ", caller emailed" : ""}.` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(null); }
  };

  return (
    <section className="card" id="book" aria-labelledby="book-h">
      <div className="kpi-head"><span className="icon-tile"><Icon name="calendar" /></span><h2 id="book-h" className="label" style={{ fontSize: 18, fontWeight: 600 }}>Book a consultation</h2></div>
      <p className="sub">Caller asked for: <b>{preferred ?? "no preference given"}</b></p>
      {isTest && <p className="banner">This is a replayed test enquiry. Booking it still updates HubSpot and sends emails (and adds a Cal.com booking if you pick a Cal.com time).</p>}
      <label htmlFor="bk-designer" style={{ display: "grid", gap: 8, maxWidth: 360 }}>Designer
        <input id="bk-designer" value={designer} onChange={(e) => setDesigner(e.target.value)} placeholder="Who will meet them?" autoComplete="off" maxLength={60} />
      </label>

      <div style={{ display: "grid", gap: 10 }}>
        <h3>Open times in Cal.com</h3>
        {calError ? <p className="banner bad">Couldn't load Cal.com times: {calError}</p>
          : slots.length === 0 ? <p className="banner">Cal.com has no open times in the next 14 days. Check your availability in Cal.com, or agree a time with the caller and record it below.</p>
          : <div className="btn-row">{slots.map((s) => (
              <button key={s} type="button" className="btn outline" onClick={() => book(s, true)} disabled={!!busy}>{busy === s ? "Booking…" : label(s)}</button>
            ))}</div>}
      </div>

      <form style={{ display: "grid", gap: 10 }} onSubmit={(e) => { e.preventDefault(); const v = (new FormData(e.currentTarget).get("when") as string) || ""; book(v, false); }}>
        <h3>Or record a time agreed by phone</h3>
        <div className="btn-row" style={{ alignItems: "flex-end" }}>
          <label htmlFor="bk-when" style={{ display: "grid", gap: 8, flex: "1 1 220px" }}>Date and time (IST)<input id="bk-when" name="when" type="datetime-local" min={istNow()} required /></label>
          <button type="submit" className="btn" disabled={!!busy} style={{ flex: "0 1 200px" }}>{busy && !slots.includes(busy) ? "Saving…" : "Save booking"}</button>
        </div>
        <p className="sub" style={{ fontSize: 13 }}>Saved here and in HubSpot, and the caller is emailed if we have their email. It isn't added to Cal.com.</p>
      </form>
      <p role="status" aria-live="polite" className={msg ? (msg.ok ? "banner ok" : "banner bad") : "visually-hidden"}>{msg?.text}</p>
    </section>
  );
}
