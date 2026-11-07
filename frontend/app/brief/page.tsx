"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCircle2, RotateCcw, Send, Users } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, Confidence, GhostButton, PageTitle, PrimaryButton, Skeleton } from "@/components/ui";
import { askBrief, errorText, getBriefText, getBroadcasts } from "@/lib/viva";
import type { BriefAnswer, Cluster } from "@/lib/types";

type Exchange = { q: string; a: BriefAnswer };

export default function Brief() {
  const { student } = useApp();
  const [brief, setBrief] = useState<string[] | null>(null);
  const [briefErr, setBriefErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [log, setLog] = useState<Exchange[]>([]);
  const [broadcasts, setBroadcasts] = useState<Cluster[]>([]);

  const loadBrief = useCallback(() => {
    setBriefErr(null);
    getBriefText().then((r) => setBrief(r.data.text.split("\n").map((l) => l.trim()).filter(Boolean))).catch((e) => setBriefErr(errorText(e)));
  }, []);
  useEffect(() => { loadBrief(); }, [loadBrief]);

  useEffect(() => {
    // Banners from the module leader. A failed poll just keeps what is already shown.
    const load = () => getBroadcasts(student).then((r) => setBroadcasts(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [student]);

  const highlight = log.find((e) => e.a.status === "answered")?.a.citation ?? null;

  const ask = async () => {
    const question = q.trim();
    if (!question) return;
    setBusy(true);
    setAskErr(null);
    try {
      const { data } = await askBrief(student, question);
      setLog((l) => [{ q: question, a: data }, ...l]);
      setQ("");
    } catch (e) {
      setAskErr(errorText(e));
    }
    setBusy(false);
  };

  return (
    <>
      <PageTitle title="Assignment brief" sub="Ask anonymously. Answers come only from the brief. If it's unclear, your module leader is asked." />

      {broadcasts.map((c) => (
        <div key={c.id} className="fadein mb-4 flex gap-3 rounded-md border border-line bg-[#f6fbf8] p-4" role="status">
          <Bell size={16} className="mt-0.5 shrink-0 text-green" />
          <div>
            <p className="text-sm font-medium">Your module leader answered: {c.summary}</p>
            <p className="mt-1 text-ink2">{c.lecturer_answer}</p>
          </div>
        </div>
      ))}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card className="p-6">
          {!brief && !briefErr && <div className="space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-full" /></div>}
          {briefErr && (
            <div className="flex items-center gap-3">
              <span className="flex-1 text-[#b42318]" role="alert">{briefErr}</span>
              <GhostButton onClick={loadBrief}><RotateCcw size={14} /> Retry</GhostButton>
            </div>
          )}
          {brief && (
            <>
              <h2 className="mb-4 text-base font-semibold">{brief[0]}</h2>
              <div className="space-y-3 leading-relaxed">
                {brief.slice(1).map((line) => {
                  const hit = highlight && line.includes(highlight.slice(0, 30));
                  return <p key={line} className={hit ? "fadein -mx-2 rounded bg-[#fff6e0] px-2 py-1 ring-1 ring-[#e8a33d66]" : ""}>{line}</p>;
                })}
              </div>
            </>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <label htmlFor="ask" className="text-sm font-medium">Ask about the brief</label>
            <p className="mb-2 text-xs text-ink2">Anonymous. Your module leader never sees your name.</p>
            <textarea
              id="ask"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
              rows={3}
              placeholder="e.g. Does the 1500 words include references?"
              className="w-full resize-none rounded border border-line px-3 py-2 outline-none focus:border-ink3"
            />
            {askErr && <p className="mt-2 text-sm text-[#b42318]" role="alert">{askErr}</p>}
            <div className="mt-2 flex justify-end">
              <PrimaryButton onClick={ask} disabled={busy || !q.trim()}><Send size={14} /> {busy ? "Checking the brief…" : askErr ? "Retry" : "Ask"}</PrimaryButton>
            </div>
          </Card>

          {log.map((e, i) => (
            <Card key={i} className="fadein space-y-2 p-4">
              <p className="text-sm font-medium">{e.q}</p>
              {e.a.status === "answered" ? (
                <>
                  <p className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green" />{e.a.answer}</p>
                  <p className="border-l-2 border-line pl-3 text-xs italic text-ink2">From the brief: “{e.a.citation}”</p>
                  <Confidence value={e.a.confidence} />
                </>
              ) : (
                <>
                  <p className="text-ink2">The brief doesn&apos;t say, so I won&apos;t guess.</p>
                  <p className="flex items-start gap-2 rounded bg-[#f5f5f5] px-3 py-2 text-sm">
                    <Users size={14} className="mt-1 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">Sent to your module leader · <span className="tnum font-medium">{e.a.cluster_size} {e.a.cluster_size === 1 ? "student" : "students"}</span> asked this</span>
                  </p>
                </>
              )}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
