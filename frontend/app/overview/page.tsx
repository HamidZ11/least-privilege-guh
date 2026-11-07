"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import MasteryMap, { type MapRow } from "@/components/MasteryMap";
import { Card, Dot, PageTitle, Skeleton } from "@/components/ui";

export default function Overview() {
  const { labs, mastery, labSessions, assessments, student, ready } = useApp();
  if (!ready) return <Skeleton className="h-64 w-full" />;

  // Weekly labs: real session concepts once Max has a session for that lab, labelled seed data until then.
  const rows: MapRow[] = [...labs].sort((a, b) => a.week - b.week).map((l) => {
    const live = labSessions[l.id];
    return {
      key: l.id, label: `Week ${l.week}`, sub: l.title, source: live ? "live" : "seed",
      concepts: live
        ? live.concepts.map((c) => ({ id: c.id, name: c.name, status: c.status, href: `/teach?lab=${l.id}&concept=${c.id}` }))
        : l.concepts.map((c) => ({ id: c.id, name: c.name, status: mastery[c.id] ?? ("untested" as const), href: `/teach?lab=${l.id}&concept=${c.id}` })),
    };
  });
  const final = assessments.find((a) => a.kind === "final" && a.session);
  if (final?.session)
    rows.push({
      key: "final", label: "Final piece", sub: "From your submission", source: "live",
      concepts: final.session.concepts.map((c) => ({ id: c.id, name: c.name, status: c.status, href: `/teach?a=final&concept=${c.id}` })),
    });

  const all = rows.flatMap((r) => r.concepts);
  const count = (s: string) => all.filter((c) => c.status === s).length;
  const stats = [
    { label: "Secure", value: count("green"), s: "green" as const },
    { label: "Getting there", value: count("amber"), s: "amber" as const },
    { label: "To work on", value: count("red"), s: "red" as const },
    { label: "Not tried yet", value: count("untested"), s: "untested" as const },
  ];
  const focus = all.filter((c) => c.status === "red" || c.status === "amber").slice(0, 4);

  return (
    <>
      <PageTitle title={`Good to see you, ${student.split(" ")[0]}`} sub={`${count("green")} of ${all.length} concepts secure so far. Your map is built from your weekly labs, your submission and your chats with Max.`} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-ink2"><Dot status={s.s} /> {s.label}</div>
            <p className="tnum mt-2 text-2xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0 p-5">
          <h3 className="mb-3 text-sm font-semibold">Mastery map by week</h3>
          <MasteryMap rows={rows} />
        </Card>
        <Card className="h-fit p-5">
          <h3 className="mb-2 text-sm font-semibold">Worth practising next</h3>
          {focus.length === 0 ? <p className="text-ink2">Nothing to fix right now. Nice work.</p> : (
            <ul className="space-y-2">
              {focus.map((c) => <li key={c.id}><Link href={c.href ?? "/teach"} className="flex items-center gap-2 hover:underline"><Dot status={c.status} /><span className="flex-1">{c.name}</span><ArrowRight size={14} className="text-ink3" /></Link></li>)}
            </ul>
          )}
          <Link href="/teach" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#111111]">Go to Teach Max <ArrowRight size={14} /></Link>
        </Card>
      </div>
    </>
  );
}
