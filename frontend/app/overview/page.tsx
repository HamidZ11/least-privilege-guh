"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import HexMap from "@/components/HexMap";
import { Card, Dot, PageTitle, Skeleton } from "@/components/ui";

export default function Overview() {
  const { labs, mastery, student, ready } = useApp();
  if (!ready) return <Skeleton className="h-64 w-full" />;

  const concepts = labs.flatMap((l) => l.concepts.map((c) => ({ ...c, week: l.week, status: mastery[c.id] ?? ("untested" as const) })));
  const count = (s: string) => concepts.filter((c) => c.status === s).length;
  const stats = [
    { label: "Secure", value: count("green"), s: "green" as const },
    { label: "Getting there", value: count("amber"), s: "amber" as const },
    { label: "To work on", value: count("red"), s: "red" as const },
    { label: "Not tried yet", value: count("untested"), s: "untested" as const },
  ];
  const focus = concepts.filter((c) => c.status === "red" || c.status === "amber").slice(0, 3);

  return (
    <>
      <PageTitle title={`Good to see you, ${student.split(" ")[0]}`} sub={`${count("green")} of ${concepts.length} lab concepts secure so far. Your mastery map is built from your weekly labs and your chats with Max.`} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-ink2"><Dot status={s.s} /> {s.label}</div>
            <p className="tnum mt-2 text-2xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold">Mastery map by weekly lab</h3>
          <div className="mx-auto max-w-lg">
            <HexMap cols={4} items={concepts.map((c) => ({ id: c.id, label: `W${c.week} ${c.name}`, status: c.status }))} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">Worth practising next</h3>
            {focus.length === 0 ? <p className="text-ink2">Nothing to fix right now. Nice work.</p> : (
              <ul className="space-y-2">
                {focus.map((c) => <li key={c.id} className="flex items-center gap-2"><Dot status={c.status} /><span className="flex-1">{c.name}</span><span className="text-xs text-ink3">Week {c.week}</span></li>)}
              </ul>
            )}
            <Link href="/teach" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#14284b]">Go to Teach Max <ArrowRight size={14} /></Link>
          </Card>
        </div>
      </div>
    </>
  );
}
