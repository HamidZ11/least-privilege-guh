"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Inbox, Megaphone, Users } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, Empty, PageTitle, PrimaryButton, Skeleton } from "@/components/ui";
import { answerCluster } from "@/lib/viva";

export default function Escalations() {
  const { clusters, refreshQueue, notify } = useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { refreshQueue(); const t = setInterval(refreshQueue, 3000); setLoaded(true); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...clusters].sort((a, b) => b.students.length - a.students.length);
  const send = async (id: string, fallback: string) => {
    setBusy(id);
    await answerCluster(id, drafts[id] ?? fallback);
    notify("student", "Your module leader answered a question about the brief. Check the Assignment brief page.", "/brief");
    refreshQueue();
    setBusy(null);
  };

  return (
    <>
      <PageTitle title="Escalations" sub="Questions the brief couldn't answer, grouped by what students actually mean. Answer once and everyone is told." />
      {!loaded && <Skeleton className="h-40 w-full" />}
      {loaded && sorted.length === 0 && <Empty icon={<Inbox size={18} />} title="Nothing to answer" body="When students ask something the brief doesn't cover, it appears here." />}
      <div className="space-y-4">
        {sorted.map((c) => (
          <Card key={c.id} className="fadein p-5">
            <div className="mb-3 flex items-start gap-3">
              <h3 className="flex-1 text-base font-semibold">{c.summary}</h3>
              <span className="tnum flex items-center gap-1.5 rounded-full bg-[#efefec] px-2.5 py-1 text-xs font-medium"><Users size={12} /> {c.students.length} students</span>
            </div>
            <ul className="mb-4 space-y-1 border-l-2 border-line pl-3 text-ink2">
              {c.questions.slice(0, 4).map((q, i) => <li key={`${q}-${i}`}>“{q}”</li>)}
              {c.questions.length > 4 && <li className="text-xs text-ink3">+ {c.questions.length - 4} more</li>}
            </ul>
            {c.status === "answered" ? (
              <div className="flex items-start gap-2 rounded bg-[#f6fbf8] px-3 py-2.5">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green" />
                <div><p className="text-sm font-medium">Answered and sent to all {c.students.length} students</p><p className="text-ink2">{c.lecturer_answer}</p></div>
              </div>
            ) : (
              <>
                <label className="text-xs font-medium text-ink2" htmlFor={`a-${c.id}`}>Suggested clarification (edit before sending)</label>
                <textarea
                  id={`a-${c.id}`}
                  rows={3}
                  value={drafts[c.id] ?? c.suggested_clarification ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                  className="mt-1 w-full resize-none rounded border border-line px-3 py-2 outline-none focus:border-ink3"
                />
                <div className="mt-2 flex justify-end">
                  <PrimaryButton disabled={busy === c.id} onClick={() => send(c.id, c.suggested_clarification ?? "")}>
                    <Megaphone size={14} /> {busy === c.id ? "Sending…" : "Answer once → broadcast to all"}
                  </PrimaryButton>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
