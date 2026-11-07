"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, CheckCircle2, Clock, FileText, Info, Loader2, Mic, ShieldAlert, Upload } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, GhostButton, NotifBadge, PageTitle, PrimaryButton } from "@/components/ui";
import { ESSAY_TEXT } from "@/lib/fixtures";
import { assessmentSession, type Assessment, type AssessStatus } from "@/lib/course";
import { submitWork } from "@/lib/viva";

const STATUS: Record<AssessStatus, { label: string; cls: string }> = {
  not_started: { label: "Not submitted", cls: "bg-[#eef1f7] text-ink2" },
  viva_due: { label: "Viva to do", cls: "bg-[#fde8e6] text-[#b42318]" },
  awaiting_review: { label: "With your module leader", cls: "bg-[#fff6e0] text-[#8f5d0a]" },
  reviewed: { label: "Reviewed", cls: "bg-[#e6f4ec] text-[#1e7a43]" },
};

function Uploader({ a, onDone }: { a: Assessment; onDone: () => void }) {
  const { student, patchAssessment, notify } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caught, setCaught] = useState(false);

  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.type === "application/pdf") { setErr("PDF reading happens on the server. For now, paste your text instead."); return; }
    setErr(null);
    setName(f.name);
    setText(await f.text());
  };

  const router = useRouter();
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const steps = [
    "Scanning for hidden instructions…",
    a.kind === "final" ? "Reading your essay…" : "Reading your work…",
    "Checking against the rubric…",
  ];
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const setStepBoth = (n: number) => { stepRef.current = n; setStep(n); };

  const go = async () => {
    setBusy(true);
    setStepBoth(0);
    // Step through the agents every ~2s while the real call runs.
    const tick = setInterval(() => { if (stepRef.current < steps.length - 1) setStepBoth(stepRef.current + 1); }, a.kind === "final" ? 2000 : 900);
    let session;
    if (a.kind === "final") {
      session = (await submitWork(student, text)).data;
    } else {
      await wait(2000);
      session = assessmentSession(a, student, text);
    }
    clearInterval(tick);
    if (session.flags.some((f) => f.type === "injection")) setCaught(true);
    // If the call finished early, flush the remaining steps quickly so every agent is shown.
    while (stepRef.current < steps.length - 1) { await wait(350); setStepBoth(stepRef.current + 1); }
    await wait(450);
    setStepBoth(steps.length);
    await wait(caught || session.flags.some((f) => f.type === "injection") ? 1400 : 600);
    patchAssessment(a.id, { status: "viva_due", session, workName: name ?? "pasted-text.txt" });
    notify("student", `Your work for "${a.title}" is in. Next step: a short spoken viva about it.`, "/submit", true);
    setBusy(false);
    onDone();
    router.push("/rubric?tab=assess");
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
        <input ref={input} type="file" accept=".txt,.md,.py,.js,.ts,.java,.c,.cpp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <textarea
        id={`w-${a.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste your work here, or upload a file…"
        className="w-full resize-none rounded border border-line bg-white px-3 py-2 outline-none focus:border-ink3"
      />
      {name && <p className="mt-1 text-xs text-ink2">Loaded {name}</p>}
      {err && <p className="mt-1 text-xs text-amber-ink" role="alert">{err}</p>}
      {caught && (
        <div className="fadein mt-3 flex items-start gap-2 rounded border border-line bg-[#fff6e0] px-3 py-2.5 text-sm" role="status">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-ink" />
          Guardian found a hidden instruction in the document, removed it and logged it. Everything else carries on as normal.
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        {a.kind === "final"
          ? <GhostButton type="button" onClick={() => setText(ESSAY_TEXT)}><FileText size={14} /> Use demo essay</GhostButton>
          : <GhostButton type="button" onClick={() => setText("Random assignment lets researchers rule out many alternative explanations because groups should differ only by chance. A larger sample is not automatically representative, since volunteers can differ from the population. Self-report measures can be affected by recall error and social desirability, so they should be treated with caution.")}><FileText size={14} /> Use demo answers</GhostButton>}
        <PrimaryButton onClick={go} disabled={busy || !text.trim()}>
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? "Submitting…" : "Submit work"}
        </PrimaryButton>
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
                  <p className="mt-0.5 flex items-center gap-3 text-sm text-ink2">
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
                {a.status === "reviewed" && <Link href="/rubric" className="text-sm font-medium text-[#14284b] underline-offset-2 hover:underline">See feedback</Link>}
              </div>
              {open === a.id && a.status === "not_started" && <Uploader a={a} onDone={() => setOpen(null)} />}
            </Card>
          );
        })}
      </div>
    </>
  );
}
