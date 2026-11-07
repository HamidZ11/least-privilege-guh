"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import ChatPanel from "@/components/ChatPanel";
import { Dot, Empty, PageTitle, Skeleton } from "@/components/ui";
import { labSession } from "@/lib/course";
import type { Session } from "@/lib/types";

export default function Teach() {
  const { labs, mastery, labSessions, saveLabSession, setMasteryFor, student, ready } = useApp();
  const [labId, setLabId] = useState<string | null>(null);

  if (!ready) return <Skeleton className="h-64 w-full" />;
  if (labs.length === 0)
    return <Empty icon={<FlaskConical size={18} />} title="No labs yet" body="Your module leader uploads each week's lab here. Max will be ready when they do." />;

  const lab = labs.find((l) => l.id === labId) ?? [...labs].sort((a, b) => b.week - a.week)[0];
  const base = labSessions[`lab-${lab.id}`] ?? labSession(lab, student, mastery);
  const session: Session = { ...base, concepts: base.concepts.map((c) => ({ ...c, status: mastery[c.id] ?? c.status })) };

  const onSession = (s: Session) => {
    saveLabSession(s);
    setMasteryFor(Object.fromEntries(s.concepts.map((c) => [c.id, c.status])));
  };

  return (
    <>
      <PageTitle title="Teach Max" sub="Pick a weekly lab. Max has some of it wrong, and teaching him is the best way to check you understand it." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="Weekly labs">
        {labs.map((l) => {
          const active = l.id === lab.id;
          return (
            <button
              key={l.id}
              role="tab"
              aria-selected={active}
              onClick={() => setLabId(l.id)}
              className={`rounded-md border p-3 text-left transition-colors ${active ? "border-[#14284b] bg-white ring-1 ring-[#14284b]" : "border-line bg-white hover:bg-[#f9fafc]"}`}
            >
              <div className="flex items-center justify-between text-xs text-ink2">
                <span className="font-semibold uppercase tracking-wide">Week {l.week}</span>
                {l.isNew && <span className="rounded bg-[#e5372a] px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>}
              </div>
              <p className="mt-0.5 font-medium">{l.title}</p>
              <div className="mt-2 flex gap-1.5">{l.concepts.map((c) => <Dot key={c.id} status={mastery[c.id] ?? "untested"} size={10} />)}</div>
            </button>
          );
        })}
      </div>

      <ChatPanel key={lab.id} kind="max" session={session} onSession={onSession} railTitle={`Week ${lab.week}: ${lab.title}`} subtitle={lab.summary} />
    </>
  );
}
