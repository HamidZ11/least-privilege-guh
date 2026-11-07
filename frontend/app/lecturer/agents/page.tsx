"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Ban, Bot, RotateCcw, ShieldAlert, ShieldCheck, ArrowUpRight, ScanSearch } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, GhostButton, PageTitle, Skeleton } from "@/components/ui";
import { errorText, getAgents } from "@/lib/viva";
import type { AgentCard, GuardianEvent } from "@/lib/types";

const ICON = { input_scanned: ScanSearch, injection_blocked: ShieldAlert, output_blocked: Ban, escalated: ArrowUpRight, passed: ShieldCheck };
const LABEL = { input_scanned: "Input scanned", injection_blocked: "Injection blocked", output_blocked: "Output blocked", escalated: "Sent to a person", passed: "Passed" };
const PILL: Record<string, string> = {
  injection_blocked: "bg-[#fde8e6] text-[#b42318]", output_blocked: "bg-[#fff6e0] text-[#8f5d0a]",
  escalated: "bg-[#f5f5f5] text-[#111111]", input_scanned: "bg-[#f5f5f5] text-ink2", passed: "bg-[#e6f4ec] text-[#1e7a43]",
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

  const header = <PageTitle title="AI agents & audit log" sub="Every AI decision is logged. A person makes the final call." />;

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

      <div className="mb-6 flex flex-wrap gap-x-8 gap-y-3 border-b border-line pb-5">
        {humanStats.map((s) => (
          <div key={s.label}><p className="text-xs text-ink2">{s.label}</p><p className="tnum mt-1 text-lg font-medium">{s.value}</p></div>
        ))}
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_64px] md:grid-cols-[minmax(0,1fr)_64px_120px] gap-4 border-b border-line bg-[#fafafa] px-5 py-3 text-xs text-ink2"><span>Agent and responsibility</span><span className="text-right">Calls</span><span className="hidden text-right md:block">Last activity</span></div>
        <div className="divide-y divide-line">
          {data.agents.map((a) => (
            <div key={a.name} className="grid grid-cols-[minmax(0,1fr)_64px] md:grid-cols-[minmax(0,1fr)_64px_120px] items-center gap-4 px-5 py-4 hover:bg-[#fafafa]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-[#fafafa] text-ink2"><Bot size={18} /></span>
                <div className="min-w-0"><h3 className="text-sm font-medium">{a.name}</h3><p className="mt-0.5 break-words text-[13px] text-ink2">{a.role}</p></div>
              </div>
              <span className="tnum text-right text-sm font-medium">{a.calls}</span>
              <span className="hidden truncate text-right text-xs text-ink2 md:block" title={a.last_action}>{a.last_action.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Audit timeline</h3>
        {data.log.length === 0 ? <p className="text-ink2">Nothing logged yet. Submit some work and it will appear here.</p> : (
          <ol className="space-y-4">
            {[...data.log].reverse().map((e, i) => {
              const Icon = ICON[e.action as keyof typeof ICON] ?? Activity;
              const bad = e.action === "injection_blocked" || e.action === "output_blocked";
              return (
                <li key={`${e.ts}-${i}`} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bad ? "bg-[#d9483b1f] text-red" : "bg-[#f5f5f5] text-ink2"}`}><Icon size={13} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILL[e.action] ?? PILL.passed}`}>{LABEL[e.action as keyof typeof LABEL] ?? e.action.replaceAll("_", " ")}</span><span className="text-ink2">{e.agent}</span></p>
                    <p className="mt-0.5 break-words text-ink2">{e.detail}</p>
                  </div>
                  <span className="tnum shrink-0 text-[11px] text-ink2">{e.ts}</span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </>
  );
}
