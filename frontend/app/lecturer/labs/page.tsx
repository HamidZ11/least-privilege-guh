"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FlaskConical, Upload } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, GhostButton, PageTitle, PrimaryButton } from "@/components/ui";

export default function LecturerLabs() {
  const { labs, uploadLab } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const nextWeek = Math.max(0, ...labs.map((l) => l.week)) + 1;
  const [week, setWeek] = useState(nextWeek);
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);

  const publish = () => {
    const names = topics.split(",").map((t) => t.trim()).filter(Boolean);
    uploadLab({
      week, title: title.trim(), fileName: file,
      summary: notes.trim().slice(0, 140) || `Week ${week} lab`,
      concepts: names.map((n, i) => ({
        id: `w${week}-${Date.now()}-${i}`, name: n,
        claim: `Students should be able to explain ${n} in their own words.`,
        misconception: `${n} is something you can mostly memorise without really understanding it.`,
      })),
    });
    setDone(`Week ${week}: ${title.trim()}`);
    setTitle(""); setTopics(""); setNotes(""); setFile(undefined); setWeek(week + 1);
  };

  return (
    <>
      <PageTitle title="Weekly labs" sub="Upload each week's lab work. Students get it in Teach Max, and their mastery map and your class insights are built from it." />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Upload a lab</h3>
          <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
            <label className="text-xs font-medium text-ink2">Week
              <input type="number" min={1} value={week} onChange={(e) => setWeek(Number(e.target.value))} className="mt-1 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-ink3" />
            </label>
            <label className="text-xs font-medium text-ink2">Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Statistical significance" className="mt-1 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-ink3" />
            </label>
          </div>
          <label className="mt-3 block text-xs font-medium text-ink2">Key topics (comma separated)
            <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="p-values, effect size" className="mt-1 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-ink3" />
          </label>
          <div className="mt-3 flex items-center justify-between">
            <label htmlFor="labnotes" className="text-xs font-medium text-ink2">Lab sheet or notes</label>
            <button type="button" onClick={() => input.current?.click()} className="text-xs text-ink2 underline-offset-2 hover:underline">Upload .txt file</button>
            <input ref={input} type="file" accept=".txt,.md" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setFile(f.name); setNotes(await f.text()); } }} />
          </div>
          <textarea id="labnotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder="Paste the lab sheet or your notes…" className="mt-1 w-full resize-none rounded border border-line px-3 py-2 outline-none focus:border-ink3" />
          {file && <p className="mt-1 text-xs text-ink2">Loaded {file}</p>}
          <div className="mt-3 flex items-center justify-between">
            <GhostButton type="button" onClick={() => { setWeek(nextWeek); setTitle("Statistical significance"); setTopics("p-values, effect size"); setNotes("This week we look at what a p-value does and does not tell us, and why effect size matters alongside it."); }}>Fill demo lab</GhostButton>
            <PrimaryButton onClick={publish} disabled={!title.trim() || !topics.trim()}><Upload size={14} /> Publish to students</PrimaryButton>
          </div>
          {done && <p className="fadein mt-3 flex items-center gap-2 rounded bg-[#e6f4ec] px-3 py-2 text-sm" role="status"><CheckCircle2 size={14} className="text-green" /> {done} published. Students have been notified. <span className="text-ink2">Saved for this demo (stored in this browser only).</span></p>}
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Published labs</h3>
          <ul className="space-y-3">
            {[...labs].sort((a, b) => a.week - b.week).map((l) => (
              <li key={l.id} className="flex items-start gap-3">
                <FlaskConical size={16} className="mt-0.5 shrink-0 text-ink2" />
                <div><p className="font-medium">Week {l.week}: {l.title}</p><p className="text-xs text-ink2">{l.concepts.map((c) => c.name).join(" · ")}</p></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
