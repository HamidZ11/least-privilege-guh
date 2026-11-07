"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Bot, RotateCcw, ShieldAlert, ShieldCheck, ArrowUpRight, ScanSearch, UserCheck } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, GhostButton, PageTitle, Skeleton } from "@/components/ui";
import { errorText, getAgents } from "@/lib/viva";
import type { AgentCard, GuardianEvent } from "@/lib/types";

const ICON = { input_scanned: ScanSearch, injection_blocked: ShieldAlert, output_blocked: Ban, escalated: ArrowUpRight, passed: ShieldCheck };
const LABEL = { input_scanned: "Input scanned", injection_blocked: "Injection blocked", output_blocked: "Output blocked", escalated: "Sent to a person", passed: "Passed" };
const PILL: Record<string, string> = {
  injection_blocked: "bg-[#fde8e6] text-[#b42318]", output_blocked: "bg-[#fff6e0] text-[#8f5d0a]",
  escalated: "bg-[#eef1f7] text-[#14284b]", input_scanned: "bg-[#eef1f7] text-ink2", passed: "bg-[#e6f4ec] text-[#1e7a43]",
};

// Where each agent shows up in the product.
const USED_IN: Record<string, string[]> = {
  Reader: ["Weekly labs (teacher upload)", "Submit work"],
  Checker: ["Feedback: weekly lab notes", "Feedback: rubric criteria"],
  Examiner: ["Viva after each submission (voice)", "Teach Max"],
  Marker: ["Viva answers", "Teach Max", "Mastery map and class insights"],
  Guardian: ["Every upload and every reply", "Student questions", "Viva reports"],
};

export default function Agents() {
  const { assessments, labs, notifs } = useApp();
  const [data, setData] = useState<{ agents: AgentCard[]; log: GuardianEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getAgents().then((r) => { setData(r.data); setError(null); }).catch((e) => setError(errorText(e)));
  }, []);
  // Polled every 2s so call counts and the log update after a submission.
  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);

  const header = <PageTitle title="AI agents & audit log" sub="Five specialised agents support teaching, practice and assessment. Every call is logged, and a person makes every final decision." />;

  if (!data && error)
    return (
      <>{header}
        <Card className="flex items-center gap-3 p-5">
          <span className="flex-1 text-[#b42318]" role="alert">{error}</span>
          <GhostButton onClick={load}><RotateCcw size={14} /> Retry</GhostButton>
        </Card>
      </>
    );
  if (!data) return <>{header}<Skeleton className="h-64 w-full" /></>;

  const awaiting = assessments.filter((a) => a.status === "awaiting_review").length;
  const decided = assessments.filter((a) => a.decision).length;
  const humanStats = [
    { label: "Vivas awaiting a human decision", value: awaiting },
    { label: "Decisions made by a person", value: decided },
    { label: "Weekly labs published", value: labs.length },
    { label: "Notifications sent", value: notifs.length },
  ];

  return (
    <>
      {header}
      {error && <p className="mb-3 text-sm text-[#b42318]" role="alert">{error} Showing the last results.</p>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {humanStats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-ink2"><UserCheck size={13} /> {s.label}</p>
            <p className="tnum mt-1 text-2xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.agents.map((a) => (
          <Card key={a.name} className="p-4">
            <div className="flex items-center gap-2"><Bot size={16} className="text-ink2" /><h3 className="flex-1 text-sm font-semibold">{a.name}</h3><span className="h-2 w-2 rounded-full bg-green" title="Active" /></div>
            <p className="mt-1 text-xs text-ink2">{a.role}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-ink3">Used in</p>
            <ul className="mt-1 text-xs text-ink2">{(USED_IN[a.name] ?? []).map((u) => <li key={u}>· {u}</li>)}</ul>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs"><span className="truncate text-ink2">{a.last_action}</span><span className="tnum shrink-0 font-medium">{a.calls} calls</span></div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Guardian log</h3>
        {data.log.length === 0 ? <p className="text-ink2">Nothing logged yet. Submit some work and it will appear here.</p> : (
          <ol className="space-y-3">
            {[...data.log].reverse().map((e, i) => {
              const Icon = ICON[e.action] ?? ShieldCheck;
              const bad = e.action === "injection_blocked" || e.action === "output_blocked";
              return (
                <li key={`${e.ts}-${i}`} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${bad ? "bg-[#d9483b1f] text-red" : "bg-[#eef1f7] text-ink2"}`}><Icon size={13} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${PILL[e.action] ?? PILL.passed}`}>{LABEL[e.action] ?? e.action}</span><span className="text-ink2">{e.agent}</span></p>
                    <p className="mt-0.5 break-words text-ink2">{e.detail}</p>
                  </div>
                  <span className="tnum shrink-0 text-xs text-ink3">{e.ts}</span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </>
  );
}
