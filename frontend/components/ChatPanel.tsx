"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Loader2, Mic, MicOff, Play, RefreshCw, RotateCcw, Send, Square, Volume2, Wand2 } from "lucide-react";
import MasteryRail from "./MasteryRail";
import { Card, GhostButton, PrimaryButton, Skeleton } from "./ui";
import { chat, errorText, rephrase, speak, stopSpeaking, type VoiceSource } from "@/lib/viva";
import type { Session, Turn } from "@/lib/types";

type Kind = "viva" | "max";
type Mode = "voice" | "text";
type Phase = "idle" | "thinking" | "speaking" | "listening";

// Minimal typing for the browser speech API (not in lib.dom for all browsers).
type Rec = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };

function useTimer(startedAt: string | null) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt || !now) return "5:00";
  const left = 300 - Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const abs = Math.abs(left);
  // Soft timer: shows time, never cuts the student off.
  return `${left < 0 ? "+" : ""}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

export default function ChatPanel({
  kind, session, onSession, railTitle, subtitle, focusConceptId,
}: {
  kind: Kind;
  session: Session;
  onSession: (s: Session) => void;
  railTitle?: string;
  subtitle?: string;
  focusConceptId?: string | null;
}) {
  const [mode, setMode] = useState<Mode>("voice");
  const [phase, setPhase] = useState<Phase>("idle");
  const [begun, setBegun] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<VoiceSource | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const recRef = useRef<Rec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // The backend decides who is talking. In a viva, mode "teach_max" means Max takes over until it returns to "viva".
  const eff: Kind = kind === "viva" && session.mode === "teach_max" && session.viva_transcript.length > 0 ? "max" : kind;
  const effRef = useRef(eff);
  effRef.current = eff;
  const isMax = eff === "max";
  const label = isMax ? "Max" : "Examiner";
  const transcript: Turn[] = isMax ? session.max_transcript : session.viva_transcript;
  const timer = useTimer(kind === "viva" ? session.viva_started_at : null);
  const finished = kind === "viva" && (session.mode === "recap" || session.mode === "done");
  const busy = phase === "thinking" || phase === "speaking";

  useEffect(() => {
    try { const m = localStorage.getItem("viva-mode"); if (m === "voice" || m === "text") setMode(m); } catch { /* ignore */ }
    return () => { stopSpeaking(); recRef.current?.stop(); };
  }, []);

  // Speech recognition only exists in Chrome and Edge. Say so instead of failing quietly.
  type W = typeof window & { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const [voiceOk, setVoiceOk] = useState<boolean | null>(null);
  useEffect(() => {
    const w = window as W;
    const ok = !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
    setVoiceOk(ok);
    if (!ok) setMode("text");
  }, []);

  const chooseMode = (m: Mode) => {
    if (m === "voice" && voiceOk === false) return;
    setMode(m);
    try { localStorage.setItem("viva-mode", m); } catch { /* ignore */ }
    if (m === "text") { stopSpeaking(); recRef.current?.stop(); setPhase("idle"); }
  };

  const startListening = () => {
    const w = window as W;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { setError("Voice input works in Chrome — type your answer below"); retryRef.current = null; setMode("text"); setPhase("idle"); return; }
    const r = new SR();
    r.lang = "en-GB";
    r.interimResults = false;
    let got = false;
    r.onresult = (e) => {
      got = true;
      const said = e.results[0][0].transcript.trim();
      if (said) send(said);
    };
    r.onerror = () => { setPhase("idle"); };
    r.onend = () => { if (!got) setPhase((p) => (p === "listening" ? "idle" : p)); };
    recRef.current = r;
    setError(null);
    setPhase("listening");
    r.start();
  };

  const send = async (value: string | null) => {
    recRef.current?.stop();
    stopSpeaking();
    setPhase("thinking");
    setError(null);
    const cur = sessionRef.current;
    const curKind = effRef.current;
    if (value) {
      const key = curKind === "max" ? "max_transcript" : "viva_transcript";
      const t = curKind === "max" ? cur.max_transcript : cur.viva_transcript;
      onSession({ ...cur, [key]: [...t, { role: "student", text: value, concept_id: cur.current_concept_id }] });
    }
    try {
      const next = (await chat(curKind, cur, value)).data;
      onSession(next);
      retryRef.current = null;
      // Whoever the backend says is speaking now (it may have switched mode).
      const nextKind: Kind = kind === "viva" && next.mode === "teach_max" && next.viva_transcript.length > 0 ? "max" : kind;
      const last = (nextKind === "max" ? next.max_transcript : next.viva_transcript).at(-1);
      if (modeRef.current === "voice" && last && last.role !== "student") {
        setPhase("speaking");
        const src = await speak(last.text, nextKind === "max" ? "max" : "examiner");
        setSource(src);
        const done = kind === "viva" && (next.mode === "recap" || next.mode === "done");
        if (modeRef.current === "voice" && !done) startListening();
        else setPhase("idle");
      } else {
        setPhase("idle");
      }
    } catch (e) {
      // Put the student's words back so Retry can resend them.
      setError(errorText(e));
      retryRef.current = () => send(value);
      setPhase("idle");
    }
  };

  // Text mode starts on its own. Voice mode waits for a click (browsers block audio until the user acts).
  useEffect(() => {
    if (transcript.length === 0 && !begun && mode === "text") { setBegun(true); send(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session.id]);

  // When the backend hands over to Max mid-viva and Max has not spoken yet, let him open.
  const kicked = useRef<string | null>(null);
  useEffect(() => {
    if (kind === "viva" && eff === "max" && session.max_transcript.length === 0 && begun && phase === "idle" && kicked.current !== session.id) {
      kicked.current = session.id;
      send(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eff, begun, phase]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript.length, phase]);

  const begin = () => { setBegun(true); send(null); };
  const resume = () => {
    setBegun(true);
    const lastAi = [...transcript].reverse().find((t) => t.role !== "student");
    if (lastAi && modeRef.current === "voice") {
      setPhase("speaking");
      speak(lastAi.text, isMax ? "max" : "examiner").then((s) => { setSource(s); startListening(); });
    } else send(null);
  };

  const needsStart = mode === "voice" && !begun && phase === "idle" && !finished;
  const status = {
    idle: "Tap the mic to answer, or type below",
    thinking: `${label} is thinking…`,
    speaking: `${label} is speaking…`,
    listening: "Listening… speak now",
  }[phase];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <Card className="flex h-[calc(100vh-18rem)] min-h-[480px] flex-col">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white transition-colors ${isMax ? "bg-[#0f766e]" : "bg-btn"}`}>{isMax ? "M" : "E"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{isMax ? "Max, a fellow student" : "Viva examiner"}</p>
            <p className="truncate text-xs text-ink2">{subtitle ?? (isMax ? "Max thinks he understands this. Correct him." : "A short conversation about your own work")}</p>
          </div>
          {kind === "viva" && <span className="tnum rounded border border-line px-2 py-1 text-sm" aria-label="Viva timer">{timer}</span>}
          <div className="flex rounded border border-line text-sm" role="group" aria-label="Answer mode">
            <button onClick={() => chooseMode("voice")} aria-pressed={mode === "voice"} disabled={voiceOk === false} title={voiceOk === false ? "Voice input works in Chrome" : undefined} className={`flex items-center gap-1.5 px-2.5 py-1.5 ${mode === "voice" ? "bg-btn font-semibold text-white" : "text-ink2 hover:bg-[#f6f6f4]"}`}><Mic size={14} /> Voice</button>
            <button onClick={() => chooseMode("text")} aria-pressed={mode === "text"} className={`flex items-center gap-1.5 px-2.5 py-1.5 ${mode === "text" ? "bg-btn font-semibold text-white" : "text-ink2 hover:bg-[#f6f6f4]"}`}><Keyboard size={14} /> Text</button>
          </div>
        </div>

        {voiceOk === false && (
          <p className="border-b border-line bg-[#fff6e0] px-5 py-2 text-sm text-[#8f5d0a]" role="status">Voice input works in Chrome — type your answer below</p>
        )}
        {kind === "viva" && isMax && (
          <div className="fadein flex items-center gap-2 border-b border-line bg-[#e6f4f2] px-5 py-2 text-sm text-[#0b5a54]" role="status">
            <Wand2 size={14} /> Switching to Teach Max: let&apos;s fix this one first
          </div>
        )}
        {finished && (
          <div className="border-b border-line bg-[#f6f7fa] px-5 py-3 text-sm">
            <p className="mb-1 font-medium">Viva complete. Your module leader will review it.</p>
            {session.revise.length > 0 && <><p className="text-ink2">Three things worth revising:</p>
            <ol className="list-decimal pl-5 text-ink2">{session.revise.map((r) => <li key={r}>{r}</li>)}</ol></>}
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
          {transcript.length === 0 && phase === "thinking" && <div className="space-y-2"><Skeleton className="h-12 w-3/4" /><Skeleton className="h-12 w-1/2" /></div>}
          {transcript.map((t, i) => {
            const mine = t.role === "student";
            return (
              <div key={i} className={`fadein flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-md px-3.5 py-2.5 ${mine ? "bg-btn text-white" : isMax ? "bg-[#e6f4f2]" : "bg-[#eef1f7]"}`}>
                  {!mine && <p className="mb-0.5 text-xs font-medium text-ink2">{label}{mode === "voice" && <span className="font-normal"> · captions</span>}</p>}
                  <p className="whitespace-pre-wrap leading-relaxed">{t.text}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="mx-5 mb-2 flex items-center gap-3 rounded border border-[#f5c2bd] bg-[#fff5f4] px-3 py-2 text-sm" role="alert">
            <span className="flex-1 text-[#b42318]">{error}</span>
            {retryRef.current && <GhostButton type="button" onClick={() => retryRef.current?.()}><RotateCcw size={14} /> Retry</GhostButton>}
          </div>
        )}

        {mode === "voice" && (
          <div className="flex flex-col items-center gap-2 border-t border-line bg-[#f9fafc] px-5 py-3">
            {needsStart ? (
              <>
                <PrimaryButton onClick={transcript.length ? resume : begin} className="!h-11 px-5"><Play size={16} /> {transcript.length ? "Resume voice session" : isMax ? "Start talking to Max" : "Start your viva"}</PrimaryButton>
                <p className="text-xs text-ink2">{label} will speak to you out loud. Turn your sound on.</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => (phase === "listening" ? recRef.current?.stop() : phase === "speaking" ? (stopSpeaking(), startListening()) : startListening())}
                    disabled={finished || phase === "thinking"}
                    aria-label={phase === "listening" ? "Stop listening" : "Answer by voice"}
                    className={`relative flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors disabled:bg-[#cfcfcc] ${phase === "listening" ? "bg-[#e5372a]" : "bg-btn hover:bg-[#0d1c38]"}`}
                  >
                    {phase === "listening" && <span className="absolute inset-0 animate-ping rounded-full bg-[#e5372a] opacity-30" />}
                    {phase === "listening" ? <MicOff size={20} /> : phase === "thinking" ? <Loader2 size={20} className="animate-spin" /> : phase === "speaking" ? <Volume2 size={20} /> : <Mic size={20} />}
                  </button>
                  {phase === "speaking" && <GhostButton type="button" onClick={() => { stopSpeaking(); setPhase("idle"); }}><Square size={12} /> Skip</GhostButton>}
                </div>
                <p className="text-sm font-medium" role="status">{finished ? "Viva complete" : status}</p>
                <p className="text-xs text-ink3">
                  {source === "elevenlabs" ? "Voice: ElevenLabs" : source === "none" ? "Voice unavailable right now, showing text only" : "Speaks with ElevenLabs, listens with your browser"}
                </p>
              </>
            )}
          </div>
        )}

        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(e) => { e.preventDefault(); const v = text.trim(); if (v && !finished && phase !== "thinking") { setText(""); setBegun(true); send(v); } }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            rows={2}
            disabled={finished}
            placeholder={isMax ? "Explain it to Max in your own words…" : "Type your answer…"}
            aria-label="Your answer"
            className="min-h-[44px] flex-1 resize-none rounded border border-line px-3 py-2 outline-none focus:border-ink3 disabled:bg-[#f6f6f4]"
          />
          {!isMax && (
            <GhostButton type="button" disabled={busy || finished} onClick={async () => {
              try { onSession((await rephrase(session)).data); } catch (e) { setError(errorText(e)); }
            }}>
              <RefreshCw size={14} /> Plain English
            </GhostButton>
          )}
          <PrimaryButton type="submit" disabled={phase === "thinking" || finished || !text.trim()} aria-label="Send">
            {phase === "thinking" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
          </PrimaryButton>
        </form>
      </Card>

      <div className="space-y-4">
        <MasteryRail concepts={session.concepts} activeId={focusConceptId ?? session.current_concept_id} title={railTitle} />
        <p className="px-1 text-xs text-ink3">
          {isMax ? "This is practice, not marked. " : "Your answers are checked against your own submission. "}
          A human always makes the final call.
        </p>
      </div>
    </div>
  );
}
