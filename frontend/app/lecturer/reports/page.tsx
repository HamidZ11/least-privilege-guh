"use client";

import { useState } from "react";
import { Flag as FlagIcon, ShieldAlert, UserCheck, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import HexMap from "@/components/HexMap";
import { Card, Confidence, Dot, GhostButton, PageTitle, Pill, PrimaryButton, Skeleton } from "@/components/ui";
import { STUDENTS_FIXTURE } from "@/lib/fixtures";
import type { Assessment } from "@/lib/course";

const VIVA_LABEL = { not_started: "Not submitted", viva_due: "Viva not done", awaiting_review: "Awaiting your decision", reviewed: "Reviewed" } as const;

export default function Reports() {
  const { assessments, ready, decide, notify, student } = useApp();
  const [tab, setTab] = useState("final");
  const [open, setOpen] = useState<Assessment | null>(null);
  const [note, setNote] = useState("");

  if (!ready) return <Skeleton className="h-64 w-full" />;
  const a = assessments.find((x) => x.id === tab)!;
  const live = a.session && a.status !== "not_started";
  const pending = assessments.filter((x) => x.status === "awaiting_review").length;
  // Open drawer always reflects the latest stored state.
  const current = open ? assessments.find((x) => x.id === open.id) ?? open : null;

  const rows = [
    ...(live ? [{ name: student, rubric: a.session!.rubric.map((r) => r.status), viva: VIVA_LABEL[a.status], flags: a.session!.flags.length, real: true }] : []),
    ...STUDENTS_FIXTURE.filter((s) => s.name !== student).map((s) => ({ name: s.name, rubric: s.rubric, viva: s.viva === "done" ? "Reviewed" : s.viva === "in progress" ? "Viva not done" : "Not submitted", flags: s.flags, real: false })),
  ];

  const choose = (outcome: "satisfied" | "follow_up") => {
    if (!current) return;
    decide(current.id, { outcome, note: note.trim() || (outcome === "satisfied" ? "Explained their work clearly." : "Would like to talk through some answers."), by: "Module leader" });
    notify("student", `Your module leader has reviewed your viva for "${current.title}".`, "/rubric");
    setNote("");
  };

  return (
    <>
      <PageTitle title="Viva reports" sub="Evidence, not verdicts. You make the final call." />

      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line" role="tablist">
        {assessments.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm ${tab === x.id ? "border-[#14284b] font-semibold text-[#14284b]" : "border-transparent text-ink2 hover:text-ink"}`}>
            {x.title.split(":")[0]}
            {x.status === "awaiting_review" && <span className="h-2 w-2 rounded-full bg-[#e5372a]" aria-label="needs decision" />}
          </button>
        ))}
        {pending > 0 && <span className="ml-auto pb-2 text-xs text-ink2">{pending} waiting for your decision</span>}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-line bg-[#f9fafc] text-xs uppercase tracking-wide text-ink3">
            <tr><th className="px-4 py-2.5 font-semibold">Student</th><th className="px-4 py-2.5 font-semibold">Rubric</th><th className="px-4 py-2.5 font-semibold">Viva</th><th className="px-4 py-2.5 font-semibold">Flags</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} onClick={() => r.real && setOpen(a)} className={`border-b border-line last:border-0 ${r.real ? "cursor-pointer hover:bg-[#f9fafc]" : ""}`}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3"><span className="flex gap-1.5">{r.rubric.map((s, i) => <Dot key={i} status={s} size={10} />)}</span></td>
                <td className="px-4 py-3 text-ink2">
                  {r.viva === "Awaiting your decision" ? <span className="rounded bg-[#fde8e6] px-2 py-0.5 text-xs font-semibold text-[#b42318]">{r.viva}</span> : r.viva}
                </td>
                <td className="px-4 py-3">{r.flags > 0 ? <span className="tnum inline-flex items-center gap-1 rounded bg-[#fff6e0] px-2 py-0.5 text-xs"><FlagIcon size={11} /> {r.flags}</span> : <span className="text-ink3">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-ink3">{live ? `${student} is live data. ` : `No live submission for this piece yet. `}Other students are labelled demo data.</p>

      {current?.session && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setOpen(null)}>
          <aside className="fadein h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} aria-label="Student report">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{current.session.student}</h2>
              <button onClick={() => setOpen(null)} aria-label="Close" className="rounded p-1 hover:bg-[#f6f6f4]"><X size={16} /></button>
            </div>
            <p className="mb-1 text-sm">{current.title}</p>
            <p className="mb-4 text-xs text-ink2">Evidence, not verdicts. You make the final call.</p>

            <h3 className="mb-2 text-sm font-semibold">Topics from the viva</h3>
            <HexMap cols={3} items={current.session.concepts.map((c) => ({ id: c.id, label: c.name, status: c.status }))} />

            <h3 className="mb-2 mt-5 text-sm font-semibold">Rubric check</h3>
            <ul className="space-y-2">
              {current.session.rubric.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm"><Dot status={r.status} /><span className="flex-1">{r.criterion}</span><span className="tnum text-xs text-ink3">{r.weight}%</span><Confidence value={r.confidence} /></li>
              ))}
            </ul>

            <h3 className="mb-2 mt-5 text-sm font-semibold">Flags ({current.session.flags.length})</h3>
            {current.session.flags.length === 0 && <p className="text-ink2">No flags.</p>}
            <ul className="space-y-3">
              {current.session.flags.map((f, i) => (
                <li key={i} className="rounded border border-line p-3">
                  <div className="mb-1 flex items-center gap-2">
                    {f.type === "injection" && <ShieldAlert size={14} className="text-red" />}
                    <Pill status={f.severity === "high" ? "red" : f.severity === "warn" ? "amber" : "untested"}>{f.type.replace(/_/g, " ")}</Pill>
                  </div>
                  <p className="text-sm">{f.detail}</p>
                  <p className="mt-2 border-l-2 border-line pl-3 text-xs text-ink2">“{f.evidence_quote}”</p>
                  {f.transcript_index !== null && <p className="mt-1 text-xs text-ink3">Viva transcript line {f.transcript_index + 1}</p>}
                </li>
              ))}
            </ul>

            <h3 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold"><UserCheck size={14} /> Your decision</h3>
            {current.status === "reviewed" ? (
              <p className="rounded bg-[#e6f4ec] px-3 py-2 text-sm">Decision recorded: {current.decision?.outcome === "satisfied" ? "Satisfied" : "Follow-up conversation"}. {current.decision?.note}</p>
            ) : current.status === "awaiting_review" ? (
              <>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note for the student…" className="w-full resize-none rounded border border-line px-3 py-2 outline-none focus:border-ink3" />
                <div className="mt-2 flex gap-2">
                  <PrimaryButton onClick={() => choose("satisfied")}>Satisfied</PrimaryButton>
                  <GhostButton onClick={() => choose("follow_up")}>Arrange follow-up</GhostButton>
                </div>
              </>
            ) : <p className="text-ink2">The student hasn&apos;t completed the viva yet.</p>}
          </aside>
        </div>
      )}
    </>
  );
}
