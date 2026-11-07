"use client";

import { useEffect, useState } from "react";
import { Activity, Ban, Bot, ShieldAlert, ShieldCheck, ArrowUpRight, ScanSearch, UserCheck } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { getAgents } from "@/lib/viva";
import type { AgentCard, GuardianEvent } from "@/lib/types";

const ICON = { input_scanned: ScanSearch, injection_blocked: ShieldAlert, output_blocked: Ban, escalated: ArrowUpRight, passed: ShieldCheck };
const LABEL = { input_scanned: "Input scanned", injection_blocked: "Injection blocked", output_blocked: "Output blocked", escalated: "Sent to a person", passed: "Passed" };

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
  useEffect(() => {
    const load = () => getAgents().then((r) => setData(r.data));
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <Skeleton className="h-64 w-full" />;
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
      <PageTitle title="AI agents & audit log" sub="Five specialised agents support teaching, practice and assessment. Every call is logged, and a person makes every final decision." />

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
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs"><span className="text-ink2">{a.last_action}</span><span className="tnum font-medium">{a.calls} calls</span></div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Guardian log</h3>
        <ol className="space-y-3">
          {[...data.log].reverse().map((e, i) => {
            const Icon = ICON[e.action as keyof typeof ICON] ?? Activity;
            const bad = e.action === "injection_blocked" || e.action === "output_blocked";
            return (
              <li key={i} className="fadein flex items-start gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${bad ? "bg-[#d9483b1f] text-red" : "bg-[#eef1f7] text-ink2"}`}><Icon size={13} /></span>
                <div className="flex-1"><p className="text-sm font-medium">{LABEL[e.action as keyof typeof LABEL] ?? e.action.replaceAll("_", " ")}</p><p className="text-ink2">{e.detail}</p></div>
                <span className="tnum text-xs text-ink3">{e.ts}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}
