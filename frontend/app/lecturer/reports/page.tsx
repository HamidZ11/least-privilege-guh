"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag as FlagIcon, RotateCcw, ShieldAlert, UserCheck, Users, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ConceptTile } from "@/components/MasteryMap";
import { Card, Confidence, Dot, Empty, GhostButton, PageTitle, Pill, PrimaryButton, Skeleton } from "@/components/ui";
import { errorText, getReports } from "@/lib/viva";
import type { Session } from "@/lib/types";

export default function Reports() {
  const { assessments, decide, notify } = useApp();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    getReports().then((r) => { setSessions(r.data); setError(null); }).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  // A student's real session is linked to a local assessment when they submitted through this app.
  const linked = (s: Session) => assessments.find((a) => a.session?.id === s.id);
  const vivaLabel = (s: Session) => {
    const a = linked(s);
    if (a?.status === "awaiting_review") return "Awaiting your decision";
    if (a?.status === "reviewed") return "Reviewed";
    return s.mode === "done" ? "Reviewed" : "Viva not done";
  };

  if (!sessions && error)
    return (
      <>
        <PageTitle title="Viva reports" sub="Evidence, not verdicts. You make the final call." />
        <Card className="flex items-center gap-3 p-5">
          <span className="flex-1 text-[#b42318]" role="alert">{error}</span>
          <GhostButton onClick={load}><RotateCcw size={14} /> Retry</GhostButton>
        </Card>
      </>
    );
  if (!sessions) return <Skeleton className="h-64 w-full" />;

  const rows = sessions.map((s) => ({
    s, name: s.student, rubric: s.rubric.map((r) => r.status), viva: vivaLabel(s), flags: s.flags.length,
  }));
  const open = sessions.find((s) => s.id === openId) ?? null;
  const openA = open ? linked(open) : undefined;
  const pending = rows.filter((r) => r.viva === "Awaiting your decision").length;

  const choose = (outcome: "satisfied" | "follow_up") => {
    if (!openA) return;
    decide(openA.id, { outcome, note: note.trim() || (outcome === "satisfied" ? "Explained their work clearly." : "Would like to talk through some answers."), by: "Module leader" });
    notify("student", `Your module leader has reviewed your viva for "${openA.title}".`, "/rubric");
    setNote("");
  };

  return (
    <>
      <PageTitle title="Viva reports" sub="Evidence, not verdicts. You make the final call." />
      {error && <p className="mb-3 text-sm text-[#b42318]" role="alert">{error} Showing the last results.</p>}
      {pending > 0 && <p className="mb-3 text-sm text-ink2">{pending} waiting for your decision</p>}

      {rows.length === 0 ? (
        <Empty icon={<Users size={18} />} title="No reports yet" body="When students submit work and complete their viva, their evidence appears here for you to review." />
      ) : (
        <Card className="overflow-x-auto !rounded-xl">
          <table className="w-full min-w-[560px] text-left">
            <thead className="border-b border-line bg-[#fafafa] text-xs text-ink2">
              <tr><th className="px-4 py-2.5 font-semibold">Student</th><th className="px-4 py-2.5 font-semibold">Rubric</th><th className="px-4 py-2.5 font-semibold">Viva</th><th className="px-4 py-2.5 font-semibold">Flags</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s.id} onClick={() => setOpenId(r.s.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setOpenId(r.s.id); }}
                  className="cursor-pointer border-b border-line outline-none last:border-0 hover:bg-[#fafafa] focus-visible:bg-[#f5f5f5]">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-[#fafafa] text-xs text-ink2">{r.name.slice(0, 1)}</span><div><p className="font-medium">{r.name}</p><p className="mt-0.5 text-xs text-ink2">CMP2045 · Student submission</p></div></div></td>
                  <td className="px-4 py-3"><span className="flex gap-1.5">{r.rubric.map((s, i) => <Dot key={i} status={s} size={10} />)}</span></td>
                  <td className="px-4 py-3 text-ink2">
                    {r.viva === "Awaiting your decision" ? <span className="rounded-full bg-[#fde8e6] px-2.5 py-1 text-xs font-medium text-[#b42318]">{r.viva}</span> : r.viva}
                  </td>
                  <td className="px-4 py-3">{r.flags > 0 ? <span className="tnum inline-flex items-center gap-1 rounded bg-[#fff6e0] px-2 py-0.5 text-xs"><FlagIcon size={11} /> {r.flags}</span> : <span className="text-ink3">—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4} className="border-t border-line px-4 py-2">{rows.length} student reports · Evidence, not verdicts</td></tr></tfoot>
          </table>
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/15" onClick={() => setOpenId(null)}>
          <aside className="fadein h-full w-full max-w-md overflow-y-auto border-l border-line bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()} aria-label="Student report">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{open.student}</h2>
              <button onClick={() => setOpenId(null)} aria-label="Close" className="rounded p-1 hover:bg-[#f6f6f4]"><X size={16} /></button>
            </div>
            <p className="mb-4 text-xs text-ink2">Evidence, not verdicts. You make the final call.</p>

            <h3 className="mb-2 text-sm font-semibold">Summary</h3>
            <p className="mb-4 text-sm text-ink2">
              {open.concepts.filter((c) => c.status === "green").length} of {open.concepts.length} concepts secure
              · {open.concepts.filter((c) => c.status === "red").length} to work on · {open.flags.length} flag{open.flags.length === 1 ? "" : "s"} · {vivaLabel(open)}
            </p>

            <h3 className="mb-2 text-sm font-semibold">Mastery map</h3>
            <div className="flex flex-wrap gap-x-1 gap-y-1">
              {open.concepts.map((c) => <ConceptTile key={c.id} compact c={{ id: c.id, name: c.name, status: c.status }} />)}
            </div>

            <h3 className="mb-2 mt-5 text-sm font-semibold">Rubric check</h3>
            <ul className="space-y-2">
              {open.rubric.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm"><Dot status={r.status} /><span className="flex-1">{r.criterion}</span><span className="tnum text-xs text-ink3">{r.weight}%</span><Confidence value={r.confidence} /></li>
              ))}
            </ul>

            <h3 className="mb-2 mt-5 text-sm font-semibold">Flags ({open.flags.length})</h3>
            {open.flags.length === 0 && <p className="text-ink2">No flags.</p>}
            <ul className="space-y-3">
              {open.flags.map((f, i) => {
                const line = f.transcript_index !== null ? open.viva_transcript[f.transcript_index] : undefined;
                return (
                  <li key={i} className="rounded-xl border border-line p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <Pill status={f.severity === "high" ? "red" : f.severity === "warn" ? "amber" : "untested"}>{f.type === "injection" && <ShieldAlert size={13} aria-label="Injection caught" />}{f.type.replace(/_/g, " ")}</Pill>
                    </div>
                    <p className="text-sm">{f.detail}</p>
                    <p className="mt-2 border-l-2 border-line pl-3 text-xs italic text-ink2">“{f.evidence_quote}”</p>
                    {f.transcript_index !== null && (
                      <p className="mt-1 text-xs text-ink3">Viva transcript line {f.transcript_index + 1}{line ? `: “${line.text.slice(0, 120)}${line.text.length > 120 ? "…" : ""}”` : ""}</p>
                    )}
                  </li>
                );
              })}
            </ul>

            <h3 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold"><UserCheck size={14} /> Your decision</h3>
            {openA?.status === "reviewed" ? (
              <p className="rounded bg-[#e6f4ec] px-3 py-2 text-sm">Decision recorded: {openA.decision?.outcome === "satisfied" ? "Satisfied" : "Follow-up conversation"}. {openA.decision?.note}</p>
            ) : openA?.status === "awaiting_review" ? (
              <>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note for the student…" className="w-full resize-none rounded border border-line px-3 py-2 outline-none focus:border-ink3" />
                <div className="mt-2 flex gap-2">
                  <PrimaryButton onClick={() => choose("satisfied")}>Satisfied</PrimaryButton>
                  <GhostButton onClick={() => choose("follow_up")}>Arrange follow-up</GhostButton>
                </div>
              </>
            ) : <p className="text-ink2">A decision is available once the student completes their viva in this app.</p>}
          </aside>
        </div>
      )}
    </>
  );
}
