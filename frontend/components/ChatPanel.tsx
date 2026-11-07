"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, RotateCcw, Square, Volume2, VolumeX, Wand2 } from "lucide-react";
import Composer from "./Composer";
import MasteryRail from "./MasteryRail";
import { Card, GhostButton, Skeleton } from "./ui";
import { chat, errorText, rephrase, speak, stopSpeaking } from "@/lib/viva";
import type { Session, Turn } from "@/lib/types";

type Kind = "viva" | "max";
type Phase = "idle" | "thinking" | "speaking";

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [begun, setBegun] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

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
    try { if (localStorage.getItem("viva-muted") === "1") setMuted(true); } catch { /* ignore */ }
    return () => stopSpeaking();
  }, []);

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem("viva-muted", next ? "1" : "0"); } catch { /* ignore */ }
    if (next) { stopSpeaking(); setPhase((p) => (p === "speaking" ? "idle" : p)); }
  };

  const send = async (value: string | null) => {
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
      if (!mutedRef.current && last && last.role !== "student") {
        setPhase("speaking");
        await speak(last.text, nextKind === "max" ? "max" : "examiner");
      }
      setPhase("idle");
    } catch (e) {
      // Put the student's words back so Retry can resend them.
      setError(errorText(e));
      retryRef.current = () => send(value);
      setPhase("idle");
    }
  };

  // The first line is asked for as soon as the panel opens.
  useEffect(() => {
    if (transcript.length === 0 && !begun) { setBegun(true); send(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

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

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
      <Card className="flex h-[calc(100dvh-216px)] min-h-[520px] min-w-0 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white transition-colors ${isMax ? "bg-[#0f766e]" : "bg-btn"}`}>{isMax ? "M" : "E"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{isMax ? "Max, a fellow student" : "Viva examiner"}</p>
            <p className="truncate text-xs text-ink2">{subtitle ?? (isMax ? "Max thinks he understands this. Correct him." : "A short conversation about your own work")}</p>
          </div>
          {kind === "viva" && <span className="tnum rounded border border-line px-2 py-1 text-sm" aria-label="Viva timer">{timer}</span>}
          <button
            type="button"
            onClick={toggleMuted}
            aria-pressed={muted}
            aria-label={muted ? "Unmute voice" : "Mute voice"}
            title={muted ? "Voice off" : "Voice on"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-line transition-colors ${muted ? "text-ink3" : "text-ink hover:bg-[#f6f6f4]"}`}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {kind === "viva" && isMax && (
          <div className="fadein flex items-center gap-2 border-b border-line bg-[#e6f4f2] px-5 py-2 text-sm text-[#0b5a54]" role="status">
            <Wand2 size={14} /> Switching to Teach Max: let&apos;s fix this one first
          </div>
        )}
        {finished && (
          <div className="border-b border-line bg-[#fafafa] px-5 py-3 text-sm">
            <p className="mb-1 font-medium">Viva complete. Your module leader will review it.</p>
            {session.revise.length > 0 && <><p className="text-ink2">Three things worth revising:</p>
            <ol className="list-decimal pl-5 text-ink2">{session.revise.map((r) => <li key={r}>{r}</li>)}</ol></>}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6" aria-live="polite">
          {transcript.length === 0 && phase === "thinking" && <div className="space-y-2"><Skeleton className="h-12 w-3/4" /><Skeleton className="h-12 w-1/2" /></div>}
          {transcript.map((t, i) => {
            const mine = t.role === "student";
            return (
              <div key={i} className={`fadein flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="min-w-0 max-w-[88%]">
                  <p className="mb-2 flex items-center gap-2 text-xs text-ink2">{!mine && <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${isMax ? "bg-[#0f766e]" : "bg-ink"}`}>{isMax ? "M" : "E"}</span>}<span className="font-medium">{mine ? "You" : label}</span></p>
                  <div className={`rounded-xl px-4 py-3 ${mine ? "bg-[#f0f0f0] text-ink" : isMax ? "border border-[#d8eae6] bg-[#f3f9f7]" : "border border-line bg-[#fafafa]"}`}>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{t.text}</p>
                  </div>
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

        {(phase === "speaking" || !isMax) && !finished && (
          <div className="flex items-center gap-2 px-5 text-xs text-ink2">
            {phase === "speaking" && (
              <>
                <Volume2 size={14} /> <span role="status">{label} is speaking…</span>
                <button type="button" onClick={() => { stopSpeaking(); setPhase("idle"); }} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[#f2f4f8]"><Square size={10} /> Skip</button>
              </>
            )}
            {!isMax && (
              <GhostButton type="button" className="ml-auto !h-7 text-xs" disabled={busy || finished} onClick={async () => {
                try { onSession((await rephrase(session)).data); } catch (e) { setError(errorText(e)); }
              }}>
                <RefreshCw size={12} /> Plain English
              </GhostButton>
            )}
          </div>
        )}

        <Composer
          placeholder={isMax ? "Explain it in your own words…" : "Type or dictate your answer…"}
          disabled={finished}
          sending={phase === "thinking"}
          onSend={(v) => { setBegun(true); send(v); }}
          onListeningChange={(l) => { if (l) { stopSpeaking(); setPhase((p) => (p === "speaking" ? "idle" : p)); } }}
        />
      </Card>

      <div className="min-w-0 space-y-4">
        <MasteryRail concepts={session.concepts} activeId={focusConceptId ?? session.current_concept_id} title={railTitle} />
        <p className="px-1 text-xs text-ink3">
          {isMax ? "This is practice, not marked. " : "Your answers are checked against your own submission. "}
          A human always makes the final call.
        </p>
      </div>
    </div>
  );
}
