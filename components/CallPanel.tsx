"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "livekit-client";
import { Icon } from "./icons";

type Phase = "idle" | "connecting" | "live" | "saving" | "saved" | "error";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** After a call ends, ask the server to pull it from Vaani a few times, then refresh the list. */
function useAfterCall() {
  const router = useRouter();
  return async (onDone: (found: boolean) => void) => {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 8000 : 15000));
      try {
        const r = await fetch("/api/call/refresh", { method: "POST" }).then((x) => x.json());
        if (r.pulled > 0) { router.refresh(); onDone(true); return; }
      } catch { /* keep trying */ }
      router.refresh();
    }
    onDone(false);
  };
}

function BrowserCall() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0);
  const room = useRef<Room | null>(null);
  const audio = useRef<HTMLDivElement>(null);
  const afterCall = useAfterCall();

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => () => { room.current?.disconnect(); }, []);

  const ended = () => {
    room.current = null;
    if (audio.current) audio.current.innerHTML = "";
    setPhase("saving");
    setMsg("Call ended. Saving it — it appears in the list below in a minute or two.");
    afterCall((found) => { setPhase(found ? "saved" : "idle"); setMsg(found ? "Saved. It's at the top of the list below." : "Still processing at Vaani. It will appear within 5 minutes."); });
  };

  const start = async () => {
    setPhase("connecting"); setMsg(""); setSecs(0); setMuted(false);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      if (!mic) throw new Error("Allow microphone access in your browser to talk to the agent.");
      mic.getTracks().forEach((t) => t.stop());
      const r = await fetch("/api/call/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ medium: "webrtc" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't start the call.");
      const { Room, RoomEvent, Track } = await import("livekit-client");
      const rm = new Room();
      room.current = rm;
      rm.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio && audio.current) audio.current.appendChild(track.attach()); });
      rm.on(RoomEvent.ParticipantDisconnected, () => { if (rm.remoteParticipants.size === 0) rm.disconnect(); });
      rm.on(RoomEvent.Disconnected, ended);
      await rm.connect(d.url, d.token);
      await rm.localParticipant.setMicrophoneEnabled(true);
      await rm.startAudio();
      setPhase("live");
    } catch (e) {
      room.current?.disconnect(); room.current = null;
      setPhase("error"); setMsg(e instanceof Error ? e.message : String(e));
    }
  };
  const toggleMute = async () => { const next = !muted; await room.current?.localParticipant.setMicrophoneEnabled(!next); setMuted(next); };

  return (
    <section className="card" aria-labelledby="bc-h">
      <div className="kpi-head"><span className="icon-tile"><Icon name="mic" /></span><h2 id="bc-h" className="label" style={{ fontSize: 18, fontWeight: 600 }}>Talk to the agent</h2>
        {phase === "live" && <span className="pill bad"><span aria-hidden="true">●</span>Live {mmss(secs)}</span>}
      </div>
      <p className="sub">Call the Aangan agent from this browser using your microphone, just like a caller would. The call is recorded and checked like any other.</p>
      <div ref={audio} hidden />
      {phase === "live" ? (
        <div className="btn-row">
          <button type="button" className="btn outline" onClick={toggleMute} aria-pressed={muted}>{muted ? "Unmute" : "Mute"}</button>
          <button type="button" className="btn danger" onClick={() => room.current?.disconnect()}><Icon name="phoneOff" />End call</button>
        </div>
      ) : (
        <button type="button" className="btn block" onClick={start} disabled={phase === "connecting" || phase === "saving"}>
          <Icon name="phone" />{phase === "connecting" ? "Connecting…" : phase === "saving" ? "Saving the call…" : "Start a browser call"}
        </button>
      )}
      <p role="status" aria-live="polite" className={phase === "error" ? "banner bad" : msg ? "banner ok" : "visually-hidden"}>{msg}</p>
    </section>
  );
}

function PhoneCall() {
  const [phase, setPhase] = useState<"idle" | "sending" | "ringing" | "error">("idle");
  const [msg, setMsg] = useState("");
  const afterCall = useAfterCall();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPhase("sending"); setMsg("");
    try {
      const r = await fetch("/api/call/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ medium: "telephony", number: f.get("number"), name: f.get("name") }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't start the call.");
      setPhase("ringing");
      setMsg(`Vaani is ringing ${d.number}. When the call ends it appears in the list below.`);
      afterCall((found) => { setPhase("idle"); setMsg(found ? "Saved. It's at the top of the list below." : "If the call happened, it will appear within 5 minutes."); });
    } catch (err) {
      setPhase("error"); setMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="card" aria-labelledby="pc-h">
      <div className="kpi-head"><span className="icon-tile"><Icon name="phone" /></span><h2 id="pc-h" className="label" style={{ fontSize: 18, fontWeight: 600 }}>Call a phone number</h2></div>
      <p className="sub">The agent rings this number. Uses Vaani minutes and needs a phone number set up in your Vaani account.</p>
      <form onSubmit={submit} className="form-grid">
        <label htmlFor="pc-name">Name<input id="pc-name" name="name" autoComplete="off" placeholder="e.g. Priya" maxLength={60} required /></label>
        <label htmlFor="pc-num">Phone number<input id="pc-num" name="number" type="tel" inputMode="tel" autoComplete="off" placeholder="98765 43210" required /></label>
        <div className="full"><button type="submit" className="btn block" disabled={phase === "sending" || phase === "ringing"}><Icon name="phone" />{phase === "sending" ? "Starting…" : phase === "ringing" ? "Ringing…" : "Call this number"}</button></div>
      </form>
      <p role="status" aria-live="polite" className={phase === "error" ? "banner bad" : msg ? "banner ok" : "visually-hidden"}>{msg}</p>
    </section>
  );
}

export function CallPanel() {
  return (
    <div className="grid two" aria-label="Start a call">
      <BrowserCall />
      <PhoneCall />
    </div>
  );
}
