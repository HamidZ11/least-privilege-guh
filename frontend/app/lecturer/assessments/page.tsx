"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Clock, Trash2, Upload } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, Empty, GhostButton, PageTitle, PrimaryButton, Skeleton } from "@/components/ui";
import { MODULE_RUBRIC_TEXT, type Assessment } from "@/lib/course";

const field = "mt-1 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-ink3";

/** "2026-11-27T23:59" -> "Fri 27 Nov 2026, 23:59" */
function formatDue(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time}`;
}

function counts(a: Assessment) {
  if (a.status === "not_started") return "No submissions yet";
  if (a.status === "viva_due") return "Submitted, viva not done";
  if (a.status === "awaiting_review") return "Awaiting your decision";
  return "Reviewed";
}

export default function LecturerAssessments() {
  const { assessments, labs, addAssessment, removeAssessment, ready } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"quiz" | "final">("quiz");
  const [weight, setWeight] = useState(10);
  const [due, setDue] = useState("");
  const [weeks, setWeeks] = useState<number[]>([]);
  const [brief, setBrief] = useState("");
  const [rubric, setRubric] = useState(MODULE_RUBRIC_TEXT);
  const [rubricFile, setRubricFile] = useState<string | null>(null);
  const [viva, setViva] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!ready) return <Skeleton className="h-64 w-full" />;

  const used = assessments.reduce((n, a) => n + a.weight, 0);
  const sortedWeeks = [...new Set(labs.map((l) => l.week))].sort((a, b) => a - b);
  const toggleWeek = (w: number) => setWeeks((ws) => (ws.includes(w) ? ws.filter((x) => x !== w) : [...ws, w].sort((a, b) => a - b)));

  const publish = () => {
    if (!title.trim()) return setErr("Give the assessment a title.");
    if (!due) return setErr("Set a due date and time.");
    if (!(weight > 0 && weight <= 100)) return setErr("Weight must be between 1 and 100%.");
    if (!rubric.trim()) return setErr("Add the marking rubric, or keep the module rubric.");
    setErr(null);
    addAssessment({
      title: title.trim(), kind, weight, due: formatDue(due), linkedWeeks: weeks,
      brief: brief.trim() || undefined, rubricText: rubric.trim(), vivaRequired: viva,
    });
    setDone(title.trim());
    setTitle(""); setDue(""); setWeeks([]); setBrief(""); setRubric(MODULE_RUBRIC_TEXT); setRubricFile(null); setViva(true);
  };

  return (
    <>
      <PageTitle title="Assessments" sub="Set the quizzes and final pieces for this module. Students see them in Submit work, and each one can be followed by a viva." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Add an assessment</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <label className="text-xs font-medium text-ink2">Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quiz 3: Statistical significance" className={field} />
            </label>
            <label className="text-xs font-medium text-ink2">Type
              <select value={kind} onChange={(e) => setKind(e.target.value as "quiz" | "final")} className={field}>
                <option value="quiz">Quiz</option>
                <option value="final">Final piece</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
            <label className="text-xs font-medium text-ink2">Weight (% of module)
              <input type="number" min={1} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className={field} />
            </label>
            <label className="text-xs font-medium text-ink2">Due
              <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
            </label>
          </div>
          <p className={`mt-1 text-xs ${used + weight > 100 ? "text-[#b42318]" : "text-ink3"}`}>
            {used}% of the module is already assessed{used + weight > 100 ? `. Adding ${weight}% takes it over 100%.` : "."}
          </p>

          {sortedWeeks.length > 0 && (
            <fieldset className="mt-3">
              <legend className="text-xs font-medium text-ink2">Covers weekly labs</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {sortedWeeks.map((w) => (
                  <label key={w} className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1 text-sm ${weeks.includes(w) ? "border-[#14284b] bg-[#eef1f7] font-medium text-[#14284b]" : "border-line"}`}>
                    <input type="checkbox" className="sr-only" checked={weeks.includes(w)} onChange={() => toggleWeek(w)} />
                    Week {w}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="mt-3 block text-xs font-medium text-ink2">Brief for students (optional)
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} placeholder="What students should do, word count, sources…" className={`${field} resize-none`} />
          </label>

          <div className="mt-3 flex items-center justify-between">
            <label htmlFor="rubric" className="text-xs font-medium text-ink2">Marking rubric</label>
            <span className="flex gap-3">
              <button type="button" onClick={() => { setRubric(MODULE_RUBRIC_TEXT); setRubricFile(null); }} className="text-xs text-ink2 underline-offset-2 hover:underline">Use module rubric</button>
              <button type="button" onClick={() => input.current?.click()} className="text-xs text-ink2 underline-offset-2 hover:underline">Upload .txt</button>
            </span>
            <input ref={input} type="file" accept=".txt,.md" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setRubricFile(f.name); setRubric(await f.text()); } }} />
          </div>
          <textarea id="rubric" value={rubric} onChange={(e) => setRubric(e.target.value)} rows={5} className={`${field} resize-none font-mono text-xs`} />
          <p className="mt-1 text-xs text-ink3">{rubricFile ? `Loaded ${rubricFile}. ` : ""}One criterion per line, e.g. &quot;Critical analysis (40%): …&quot;</p>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={viva} onChange={(e) => setViva(e.target.checked)} className="h-4 w-4 accent-[#14284b]" />
            Viva required after submission
          </label>

          {err && <p className="mt-3 text-sm text-[#b42318]" role="alert">{err}</p>}
          <div className="mt-4 flex justify-end">
            <PrimaryButton onClick={publish}><Upload size={14} /> Publish to students</PrimaryButton>
          </div>
          {done && (
            <p className="fadein mt-3 flex items-center gap-2 rounded bg-[#e6f4ec] px-3 py-2 text-sm" role="status">
              <CheckCircle2 size={14} className="text-green" /> {done} published. Students have been notified. <span className="text-ink2">Saved for this demo (stored in this browser only).</span>
            </p>
          )}
        </Card>

        <Card className="h-fit p-5">
          <h3 className="mb-3 text-sm font-semibold">This module&apos;s assessments</h3>
          {assessments.length === 0 ? (
            <Empty icon={<ClipboardList size={18} />} title="No assessments yet" body="Add the first quiz or final piece on the left." />
          ) : (
            <ul className="space-y-3">
              {assessments.map((a) => (
                <li key={a.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                  <ClipboardList size={16} className="mt-0.5 shrink-0 text-ink2" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink2">
                      <span className="tnum">{a.weight}%</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {a.due}</span>
                      {a.vivaRequired === false && <span>No viva</span>}
                    </p>
                    <p className="text-xs text-ink3">{counts(a)}</p>
                  </div>
                  {a.custom && a.status === "not_started" && (
                    <GhostButton type="button" onClick={() => removeAssessment(a.id)} aria-label={`Remove ${a.title}`} className="!h-7 !px-2"><Trash2 size={13} /></GhostButton>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink2"><span className="tnum font-medium">{used}%</span> of the module mark is assessed.</p>
        </Card>
      </div>
    </>
  );
}
