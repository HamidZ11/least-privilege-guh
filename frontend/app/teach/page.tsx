"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileText, FlaskConical, Loader2, RotateCcw } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import ChatPanel from "@/components/ChatPanel";
import { Dot, Empty, GhostButton, PageTitle, Skeleton } from "@/components/ui";
import { labRubricText, labWorkText } from "@/lib/course";
import { errorText, submitWork } from "@/lib/viva";
import type { Session } from "@/lib/types";

export default function Teach() {
  const { labs, mastery, labSessions, saveLabSession, assessments, patchAssessment, student, ready } = useApp();
  const params = useSearchParams();
  const finalA = assessments.find((a) => a.kind === "final" && a.session);
  const wantFinal = params.get("a") === "final" && !!finalA;
  const [labId, setLabId] = useState<string | null>(params.get("lab"));
  const [useFinal, setUseFinal] = useState(wantFinal);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<string | null>(null);
  const defaulted = useRef(false);
  const concept = params.get("concept");

  // Open on the submitted essay by default: it is the session the backend already holds.
  useEffect(() => {
    if (ready && !defaulted.current) {
      defaulted.current = true;
      if (finalA && !params.get("lab")) setUseFinal(true);
    }
  }, [ready, finalA, params]);

  const lab = labs.find((l) => l.id === labId) ?? [...labs].sort((a, b) => b.week - a.week)[0];
  const labSession = lab ? labSessions[lab.id] : undefined;

  // Labs get a real backend session (POST /api/submit) the first time they are opened.
  const create = async (l: NonNullable<typeof lab>) => {
    if (inflight.current === l.id) return;
    inflight.current = l.id;
    setCreating(l.id);
    setError(null);
    try {
      const { data } = await submitWork(student, labWorkText(l), labRubricText(l));
      saveLabSession(l.id, { ...data, mode: "teach_max" });
    } catch (e) {
      setError(errorText(e));
    }
    inflight.current = null;
    setCreating(null);
  };
  useEffect(() => {
    // No lab picked yet and an essay exists: the essay is the default, so do not create a lab session.
    if (ready && !useFinal && lab && !labSession && !error && !(finalA && !labId)) create(lab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, useFinal, lab?.id, !!labSession, labId, !!finalA]);

  if (!ready) return <Skeleton className="h-64 w-full" />;
  if (labs.length === 0 && !finalA)
    return <Empty icon={<FlaskConical size={18} />} title="No labs yet" body="Your module leader uploads each week's lab here. Max will be ready when they do." />;

  const session: Session | undefined = useFinal && finalA ? finalA.session : labSession;
  const onSession = (s: Session) => {
    if (useFinal && finalA) patchAssessment(finalA.id, { session: s });
    else if (lab) saveLabSession(lab.id, s);
  };

  return (
    <>
      <PageTitle title="Teach Max" sub="Pick a weekly lab or your own submission. Max has some of it wrong, and teaching him is the best way to check you understand it." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="What to practise">
        {finalA && (
          <button role="tab" aria-selected={useFinal} onClick={() => setUseFinal(true)}
            className={`rounded-md border p-3 text-left transition-colors ${useFinal ? "border-[#14284b] bg-white ring-1 ring-[#14284b]" : "border-line bg-white hover:bg-[#f9fafc]"}`}>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink2"><FileText size={12} /> Your final piece</div>
            <p className="mt-0.5 font-medium">Concepts from your essay</p>
            <div className="mt-2 flex gap-1.5">{finalA.session!.concepts.map((c) => <Dot key={c.id} status={c.status} size={10} />)}</div>
          </button>
        )}
        {labs.map((l) => {
          const active = !useFinal && l.id === lab?.id;
          const cs = labSessions[l.id]?.concepts;
          return (
            <button key={l.id} role="tab" aria-selected={active} onClick={() => { setUseFinal(false); setLabId(l.id); setError(null); }}
              className={`rounded-md border p-3 text-left transition-colors ${active ? "border-[#14284b] bg-white ring-1 ring-[#14284b]" : "border-line bg-white hover:bg-[#f9fafc]"}`}>
              <div className="flex items-center justify-between text-xs text-ink2">
                <span className="font-semibold uppercase tracking-wide">Week {l.week}</span>
                {l.isNew && <span className="rounded bg-[#e5372a] px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>}
              </div>
              <p className="mt-0.5 font-medium">{l.title}</p>
              <div className="mt-2 flex gap-1.5">
                {(cs ? cs.map((c) => ({ id: c.id, status: c.status })) : l.concepts.map((c) => ({ id: c.id, status: mastery[c.id] ?? ("untested" as const) }))).map((c) => <Dot key={c.id} status={c.status} size={10} />)}
              </div>
            </button>
          );
        })}
      </div>

      {error && !session && (
        <div className="flex items-center gap-3 rounded border border-[#f5c2bd] bg-[#fff5f4] px-4 py-3 text-sm" role="alert">
          <span className="flex-1 text-[#b42318]">{error}</span>
          {lab && <GhostButton onClick={() => create(lab)}><RotateCcw size={14} /> Retry</GhostButton>}
        </div>
      )}
      {!session && !error && (
        <div className="flex items-center gap-3 rounded border border-line bg-white px-4 py-6 text-ink2" role="status">
          <Loader2 size={16} className="animate-spin" /> {creating ? `Getting Max ready for Week ${lab?.week}…` : "Loading…"}
        </div>
      )}
      {session && (
        <ChatPanel
          key={session.id}
          kind="max"
          session={session}
          onSession={onSession}
          focusConceptId={concept}
          railTitle={useFinal ? "Your final piece" : `Week ${lab?.week}: ${lab?.title}`}
          subtitle={useFinal ? "Practising the concepts from your own submission" : lab?.summary}
        />
      )}
    </>
  );
}
