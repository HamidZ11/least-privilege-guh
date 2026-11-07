"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2, Mic, Square } from "lucide-react";

// Web Speech API typings: lib.dom only has them in some browsers.
type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = typeof window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

const MAX_HEIGHT = 200; // px, then the box scrolls

export default function Composer({
  placeholder,
  onSend,
  onListeningChange,
  disabled = false,
  sending = false,
}: {
  placeholder: string;
  onSend: (text: string) => void;
  /** Called with true while dictating, so the caller can pause any speech playing. */
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
  sending?: boolean;
}) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  // null until mounted (no SpeechRecognition on the server), false once missing or broken.
  const [dictationOk, setDictationOk] = useState<boolean | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<Recognition | null>(null);
  const listeningRef = useRef<(l: boolean) => void>(() => {});
  listeningRef.current = (l) => onListeningChange?.(l);

  useEffect(() => {
    const w = window as SpeechWindow;
    setDictationOk(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
    return () => recRef.current?.abort();
  }, []);

  // Grow with the text, up to MAX_HEIGHT.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [text, interim]);

  const stopListening = () => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setInterim("");
    listeningRef.current(false);
  };

  const startListening = () => {
    const w = window as SpeechWindow;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { setDictationOk(false); return; }
    const r = new SR();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0]?.transcript ?? "";
        if (e.results[i].isFinal) finalText += piece;
        else interimText += piece;
      }
      if (finalText.trim()) {
        setText((t) => (t.trim() ? `${t.replace(/\s+$/, "")} ${finalText.trim()}` : finalText.trim()));
      }
      setInterim(interimText.trim());
    };
    r.onerror = (e) => {
      // No microphone or no permission: dictation can't work here, so hide it.
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") setDictationOk(false);
      stopListening();
    };
    r.onend = () => {
      if (recRef.current === r) stopListening();
    };
    recRef.current = r;
    setListening(true);
    listeningRef.current(true);
    try { r.start(); } catch { setDictationOk(false); stopListening(); }
  };

  const canSend = text.trim().length > 0 && !disabled && !sending;

  const send = () => {
    if (!canSend) return;
    if (listening) stopListening();
    const value = text.trim();
    setText("");
    setInterim("");
    onSend(value);
    areaRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="border-t border-line p-3">
      <div
        className={`rounded-2xl border bg-white transition-shadow focus-within:shadow-sm ${listening ? "border-[#e5372a]" : "border-[#d6d6d2] focus-within:border-ink3"}`}
      >
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={interim ? "" : placeholder}
          aria-label="Your answer"
          className="block w-full resize-none bg-transparent px-4 pb-1 pt-3 text-[15px] leading-6 outline-none placeholder:text-ink3 disabled:text-ink3"
        />
        {interim && (
          <p className="px-4 pb-1 text-[15px] leading-6 text-ink3" aria-live="polite">{interim}</p>
        )}
        <div className="flex items-center justify-end gap-2 px-2 pb-2">
          {listening && <span className="mr-auto pl-2 text-xs text-[#b42318]" role="status">Listening… tap to stop</span>}
          {dictationOk === false && (
            <span className="mr-auto pl-2 text-xs text-ink3" title="Dictation works in Chrome">Dictation works in Chrome</span>
          )}
          {dictationOk && (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={disabled}
              aria-label={listening ? "Stop dictating" : "Dictate your answer"}
              aria-pressed={listening}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${listening ? "bg-[#e5372a] text-white ring-4 ring-[#e5372a]/25" : "text-ink2 hover:bg-[#f2f4f8]"}`}
            >
              {listening ? <Square size={14} /> : <Mic size={18} />}
            </button>
          )}
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label="Send"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f1f1f] text-white transition-colors hover:bg-[#333] disabled:bg-[#e3e3e0] disabled:text-[#9a9a9a]"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
