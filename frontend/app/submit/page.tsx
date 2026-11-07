"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Check, CheckCircle2, Clock, FileText, Info, Loader2, Mic, RotateCcw, ShieldAlert, Upload, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, GhostButton, NotifBadge, PageTitle, PrimaryButton } from "@/components/ui";
import { ESSAY_TEXT } from "@/lib/fixtures";
import type { Assessment, AssessStatus } from "@/lib/course";
import { errorText, submitWork } from "@/lib/viva";
import type { Session } from "@/lib/types";

const STATUS: Record<AssessStatus, { label: string; cls: string }> = {
  not_started: { label: "Not submitted", cls: "bg-[#eef1f7] text-ink2" },
  viva_due: { label: "Viva to do", cls: "bg-[#fde8e6] text-[#b42318]" },
  awaiting_review: { label: "With your module leader", cls: "bg-[#fff6e0] text-[#8f5d0a]" },
  reviewed: { label: "Reviewed", cls: "bg-[#e6f4ec] text-[#1e7a43]" },
};

const ALLOWED = [".pdf", ".docx", ".txt", ".md", ".py", ".js", ".ts", ".java", ".ipynb"];
const READABLE = [".txt", ".md", ".py", ".js", ".ts", ".java", ".ipynb"];
const MAX_BYTES = 5 * 1024 * 1024;
const ext = (n: string) => n.slice(n.lastIndexOf(".")).toLowerCase();
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function Uploader({ a, onDone }: { a: Assessment; onDone: () => void }) {
  const { student, patchAssessment, notify } = useApp();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caught, setCaught] = useState(false);
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const steps = [
    "Scanning for hidden instructions…",
    a.kind === "final" ? "Reading your essay…" : "Reading your work…",
    "Checking against the rubric…",
  ];
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const setStepBoth = (n: number) => { stepRef.current = n; setStep(n); };

  const take = (f?: File | null) => {
    if (!f) return;
    if (!ALLOWED.includes(ext(f.name))) { setErr(`We can't use ${ext(f.name) || "that"} files. Try ${ALLOWED.join(", ")}.`); return; }
    if (f.size > MAX_BYTES) { setErr(`That file is ${size(f.size)}. The limit is 5 MB.`); return; }
    setErr(null);
    setFile(f);
    if (READABLE.includes(ext(f.name))) {
      const r = new FileReader();
      r.onload = () => { const t = String(r.result ?? ""); setText(t); setFileText(t); };
      r.onerror = () => setErr("We couldn't read that file. Try pasting your text instead.");
      r.readAsText(f);
    } else {
      setFileText(null);
    }
  };
  const clearFile = () => { setFile(null); setFileText(null); if (input.current) input.current.value = ""; };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); take(e.dataTransfer.files?.[0]); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); input.current?.click(); }
  };

  const go = async () => {
    setBusy(true);
    setErr(null);
    setCaught(false);
    setStepBoth(0);
    // Step through the agents every ~2s while the real call runs.
    const tick = setInterval(() => { if (stepRef.current < steps.length - 1) setStepBoth(stepRef.current + 1); }, 2000);
    try {
      // Send the file if there is one (and the text was not edited since it loaded), otherwise the text.
      const useFile = file && (fileText === null || text === fileText);
      const session: Session = (await submitWork(student, useFile ? file : text)).data;
      clearInterval(tick);
      const injected = session.flags.some((f) => f.type === "injection");
      if (injected) setCaught(true);
      while (stepRef.current < steps.length - 1) { await wait(350); setStepBoth(stepRef.current + 1); }
      await wait(450);
      setStepBoth(steps.length);
      await wait(injected ? 1400 : 600);
      patchAssessment(a.id, { status: "viva_due", session, workName: file?.name ?? "pasted-text.txt" });
      notify("student", `Your work for "${a.title}" is in. Next step: a short spoken viva about it.`, "/submit", true);
      setBusy(false);
      onDone();
      router.push("/rubric?tab=assess");
    } catch (e) {
      clearInterval(tick);
      setBusy(false);
      setErr(errorText(e));
    }
  };

  if (busy)
    return (
      <div className="border-t border-line bg-[#f9fafc] p-5" role="status" aria-live="polite">
        <p className="mb-3 text-sm font-semibold">Your work is being checked</p>
        <ol className="space-y-2.5">
          {steps.map((label, i) => {
            const done = step > i;
            const active = step === i;
            return (
              <li key={label} className={`flex items-center gap-3 text-sm ${done || active ? "text-ink" : "text-ink3"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-green text-white" : active ? "border border-[#14284b]" : "border border-line"}`}>
                  {done ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin text-[#14284b]" /> : null}
                </span>
                <span>{label.replace("…", done ? "" : "…")}</span>
              </li>
            );
          })}
        </ol>
        {caught && (
          <div className="fadein mt-4 flex items-start gap-2 rounded border border-line bg-[#fff6e0] px-3 py-2.5 text-sm">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-ink" />
            Guardian found a hidden instruction in the document, removed it and logged it. Everything else carries on as normal.
          </div>
        )}
      </div>
    );

  return (
    <div className="border-t border-line bg-[#f9fafc] p-5">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium" htmlFor={`w-${a.id}`}>Your work</label>
        <button type="button" onClick={() => input.current?.click()} className="text-xs text-ink2 underline-offset-2 hover:underline">Upload .txt / code file</button>
        <input ref={input} type="file" accept={ALLOWED.join(",")} hidden onChange={(e) => take(e.target.files?.[0])} />
      </div>

      <div
        role="group"
        tabIndex={0}
        aria-label="Upload your work"
        onKeyDown={onKey}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={onDrop}
        className={`relative rounded border-2 border-dashed outline-none focus-visible:ring-2 focus-visible:ring-[#14284b] ${dragging ? "border-[#14284b] bg-[#eef1f7]" : "border-[#c9cfdb] bg-white"}`}
      >
        <textarea
          id={`w-${a.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={text || file ? "" : " "}
          aria-describedby={`drop-${a.id}`}
          className="w-full resize-none rounded bg-transparent px-3 py-2 outline-none"
        />
        {!text && !file && !dragging && (
          <div id={`drop-${a.id}`} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
            <Upload size={24} className="text-[#14284b]" />
            <p className="text-sm font-semibold text-[#14284b]">
              Drag your file here or <button type="button" onClick={() => input.current?.click()} className="pointer-events-auto underline underline-offset-2">click to browse</button>
            </p>
            <p className="text-xs text-ink2">{ALLOWED.join(", ")} up to 5 MB. Or click in the box and paste your text.</p>
          </div>
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-[#eef1f7]/90 text-sm font-semibold text-[#14284b]">
            <Upload size={16} className="mr-2" /> Drop your file to upload
          </div>
        )}
      </div>

      {file && (
        <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded border border-line bg-white px-3 py-1.5 text-sm">
          <FileText size={14} className="shrink-0 text-ink2" />
          <span className="truncate font-medium">{file.name}</span>
          <span className="shrink-0 text-xs text-ink3">{size(file.size)}</span>
          <button type="button" onClick={clearFile} aria-label={`Remove ${file.name}`} className="shrink-0 rounded p-0.5 text-ink2 hover:bg-[#f2f4f8]"><X size={14} /></button>
        </div>
      )}
      {file && fileText === null && <p className="mt-1 text-xs text-ink2">We&apos;ll read this file when you submit.</p>}

      {err && (
        <div className="mt-3 flex items-center gap-3 rounded border border-[#f5c2bd] bg-[#fff5f4] px-3 py-2 text-sm" role="alert">
          <span className="flex-1 text-[#b42318]">{err}</span>
          {(text.trim() || file) && !/can't use|limit is|couldn't read/.test(err) && <GhostButton type="button" onClick={go}><RotateCcw size={14} /> Retry</GhostButton>}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <GhostButton type="button" onClick={() => { setText(ESSAY_TEXT); setFile(null); setFileText(null); setErr(null); }}><FileText size={14} /> Use demo {a.kind === "final" ? "essay" : "answers"}</GhostButton>
        <PrimaryButton onClick={go} disabled={!text.trim() && !file}>Submit work</PrimaryButton>
      </div>
    </div>
  );
}

export default function Submit() {
  const { assessments, ready } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const due = assessments.filter((a) => a.status === "viva_due");

  return (
    <>
      <PageTitle title="Submit work" sub="Upload each piece of work for this module. After every submission you'll have a short voice viva about it." />

      {due.length > 0 && (
        <div className="fadein mb-5 flex items-center gap-3 rounded-md border border-[#f5c2bd] bg-[#fff5f4] px-4 py-3" role="status">
          <NotifBadge count={due.length} label="vivas to do" />
          <p className="flex-1 text-sm"><span className="font-semibold">Next step:</span> do your viva with the voice agent. It takes about 5 minutes.</p>
          <Link href={`/submit/viva/${due[0].id}`}><PrimaryButton><Mic size={14} /> Start viva</PrimaryButton></Link>
        </div>
      )}

      <div className="mb-4 flex items-start gap-2 rounded border border-line bg-white px-3 py-2.5 text-sm text-ink2">
        <Info size={16} className="mt-0.5 shrink-0" />
        The marking rubric is already set by your module leader. A viva checks you understand your own work. It isn&apos;t a grade, and a person makes the final decision.
      </div>

      <div className="space-y-3">
        {!ready && <div className="skeleton h-24 w-full" />}
        {assessments.map((a) => {
          const st = STATUS[a.status];
          return (
            <Card key={a.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold">{a.title}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink2">
                    <span className="tnum">{a.weight}% of module</span>
                    <span className="flex items-center gap-1"><Clock size={13} /> Due {a.due}</span>
                    {a.workName && <span className="flex items-center gap-1"><FileText size={13} /> {a.workName}</span>}
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                {a.status === "not_started" && (
                  <PrimaryButton onClick={() => setOpen(open === a.id ? null : a.id)}><Upload size={14} /> Upload work</PrimaryButton>
                )}
                {a.status === "viva_due" && (
                  <Link href={`/submit/viva/${a.id}`} className="relative">
                    <PrimaryButton><Mic size={14} /> Do your viva</PrimaryButton>
                    <span className="absolute -right-1.5 -top-1.5"><NotifBadge count={1} /></span>
                  </Link>
                )}
                {a.status === "awaiting_review" && <span className="flex items-center gap-1.5 text-sm text-ink2"><CheckCircle2 size={14} className="text-green" /> Viva done, waiting for a person to review</span>}
                {a.status === "reviewed" && <Link href="/rubric?tab=assess" className="text-sm font-medium text-[#14284b] underline-offset-2 hover:underline">See feedback</Link>}
              </div>
              {open === a.id && a.status === "not_started" && <Uploader a={a} onDone={() => setOpen(null)} />}
            </Card>
          );
        })}
      </div>
    </>
  );
}
