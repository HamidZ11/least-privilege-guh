"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ClipboardCheck, Download, Loader2, Mic, UserCheck } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, Confidence, Dot, GhostButton, PageTitle, Pill, PrimaryButton, STATUS_COLOR } from "@/components/ui";
import type { Assessment } from "@/lib/course";
import { checkLab, errorText } from "@/lib/viva";
import type { RubricCriterion } from "@/lib/types";

function Criterion({ r, practise, practiseHref }: { r: RubricCriterion; practise?: boolean; practiseHref?: string }) {
  return (
    <Card className="fadein overflow-hidden">
      <div className="flex">
        <div className="w-1 shrink-0" style={{ background: STATUS_COLOR[r.status] }} />
        <div className="flex-1 space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold">{r.criterion}</h3>
            <span className="tnum text-xs text-ink2">{r.weight}%</span>
            <Pill status={r.status} />
            <Confidence value={r.confidence} />
          </div>
          <p className="leading-relaxed">{r.gap_note}</p>
          {r.quote && <p className="border-l-2 border-line pl-3 text-xs italic text-ink2">You wrote: “{r.quote}”</p>}
          {practise && r.status !== "green" && (
            <Link href={practiseHref ?? "/teach"} className="no-print inline-flex items-center gap-1 text-sm font-medium text-[#111111]">Practise with Max <ArrowRight size={14} /></Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function LabFeedback() {
  const { labs, labFeedback, saveLabFeedback, student, notify } = useApp();
  const [labId, setLabId] = useState(labs[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [labErr, setLabErr] = useState<string | null>(null);
  const lab = labs.find((l) => l.id === labId) ?? labs[0];
  if (!lab) return null;
  const result = labFeedback[lab.id];

  const run = async () => {
    setBusy(true);
    setLabErr(null);
    try {
      const { rubric } = await checkLab(student, notes, lab);
      saveLabFeedback(lab.id, rubric);
      notify("student", `Feedback on your Week ${lab.week} lab notes is ready.`, "/rubric");
    } catch (e) {
      setLabErr(errorText(e));
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="mb-3 text-sm text-ink2">Paste or upload your lab work or notes for the week. You&apos;ll get feedback against what the lab was meant to teach. It isn&apos;t marked, and nobody else sees it.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {labs.map((l) => (
            <button key={l.id} onClick={() => setLabId(l.id)} className={`rounded border px-3 py-1.5 text-sm ${l.id === lab.id ? "border-[#111111] bg-[#f5f5f5] font-semibold text-[#111111]" : "border-line bg-white hover:bg-[#fafafa]"}`}>
              Week {l.week}: {l.title}
            </button>
          ))}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          aria-label="Your lab notes"
          placeholder={`Your Week ${lab.week} lab work or notes…`}
          className="w-full resize-none rounded border border-line px-3 py-2 outline-none focus:border-ink3"
        />
        {labErr && <p className="mt-2 text-sm text-[#b42318]" role="alert">{labErr}</p>}
        <div className="mt-3 flex justify-end">
          <PrimaryButton onClick={run} disabled={busy || !notes.trim()}>
            {busy && <Loader2 size={14} className="animate-spin" />}{busy ? "Checking…" : labErr ? "Retry" : "Check my lab notes"}
          </PrimaryButton>
        </div>
      </Card>
      {result && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Feedback on Week {lab.week}: {lab.title}</p>
          {result.map((r) => <Criterion key={r.id} r={r} practise />)}
        </div>
      )}
    </div>
  );
}

function AssessmentFeedback({ a }: { a: Assessment }) {
  const s = a.session;
  if (!s || a.status === "not_started")
    return <Card className="p-5 text-ink2">{a.title}: nothing to show yet. <Link href="/submit" className="font-medium text-[#111111] underline">Submit your work</Link> and complete the viva.</Card>;
  const awaiting = a.status !== "reviewed";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex-1 text-base font-semibold">{a.title}</h3>
        {a.status === "viva_due" && <Link href={`/submit/viva/${a.id}`}><PrimaryButton><Mic size={14} /> Do your viva</PrimaryButton></Link>}
      </div>
      {s.id.startsWith("seed-") && <p className="text-xs text-ink3">Example data</p>}
      {s.rubric.map((r) => <Criterion key={r.id} r={r} practise practiseHref={a.kind === "final" ? "/teach?a=final" : undefined} />)}

      <Card className="p-5">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Mic size={14} /> Viva feedback</h4>
        {a.status === "viva_due" ? <p className="text-ink2">Your viva hasn&apos;t happened yet.</p> : (
          <>
            <ul className="mb-3 space-y-1.5">
              {s.concepts.map((c) => <li key={c.id} className="flex items-center gap-2 text-sm"><Dot status={c.status} /><span className="flex-1">{c.name}</span><span className="text-xs text-ink3">{c.status}</span></li>)}
            </ul>
            {s.revise.length > 0 && <><p className="text-sm font-medium">To revise</p><ul className="mb-3 list-disc pl-5 text-ink2">{s.revise.map((r) => <li key={r}>{r}</li>)}</ul></>}
            {awaiting ? (
              <p className="flex items-center gap-2 rounded bg-[#fff6e0] px-3 py-2 text-sm"><UserCheck size={14} /> With your module leader for a decision.</p>
            ) : (
              <p className="flex items-center gap-2 rounded bg-[#e6f4ec] px-3 py-2 text-sm"><UserCheck size={14} /> Reviewed by {a.decision?.by}: {a.decision?.outcome === "satisfied" ? "satisfied with your understanding" : "would like a follow-up conversation"}. {a.decision?.note}</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

export default function Feedback() {
  const { assessments, ready } = useApp();
  const params = useSearchParams();
  const [tab, setTab] = useState<"labs" | "assess">(params.get("tab") === "assess" ? "assess" : "labs");
  if (!ready) return <div className="skeleton h-64 w-full" />;
  return (
    <div className="print-area mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <PageTitle title="Feedback" sub="Where to focus next. A learning check, not a grade." />
        <GhostButton className="no-print" onClick={() => window.print()}><Download size={14} /> Download PDF</GhostButton>
      </div>

      <div className="no-print mb-4 flex border-b border-line" role="tablist">
        {([["labs", "Weekly lab feedback"], ["assess", "Assessments and viva"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === k ? "border-[#111111] font-semibold text-[#111111]" : "border-transparent text-ink2 hover:text-ink"}`}>{label}</button>
        ))}
      </div>

      <div className="mb-4 flex gap-4 text-xs text-ink2">
        {(["green", "amber", "red"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />{s === "green" ? "Met" : s === "amber" ? "Partly met" : "Missing"}</span>
        ))}
      </div>

      {tab === "labs" ? <LabFeedback /> : (
        <div className="space-y-8">
          {assessments.map((a) => <AssessmentFeedback key={a.id} a={a} />)}
          {assessments.every((a) => a.status === "not_started") && <p className="flex items-center gap-2 text-ink2"><ClipboardCheck size={14} /> Rubric and viva feedback appear here after each submission.</p>}
        </div>
      )}
    </div>
  );
}
