"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Grid3x3, MessageSquareQuote, RotateCcw } from "lucide-react";
import { Card, Dot, Empty, GhostButton, PageTitle, Pill, Skeleton, STATUS_COLOR } from "@/components/ui";
import { errorText, getHeatmap, getQueue } from "@/lib/viva";
import type { Cluster, HeatmapRow, Status } from "@/lib/types";

const total = (r: HeatmapRow) => r.red + r.amber + r.green;
const dominant = (r: HeatmapRow): Status => (r.red >= r.amber && r.red >= r.green ? "red" : r.amber >= r.green ? "amber" : "green");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export default function Heatmap() {
  const [rows, setRows] = useState<HeatmapRow[] | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getHeatmap().then((r) => setRows(r.data)).catch((e) => setError(errorText(e)));
    getQueue().then((r) => setClusters(r.data)).catch(() => { /* brief card is optional */ });
  }, []);
  useEffect(() => { load(); }, [load]);

  const header = <PageTitle title="Class insights" sub="How the whole class is doing on each concept. Demo data for 20 students, labelled." />;

  if (error && !rows)
    return (
      <>{header}
        <Card className="flex items-center gap-3 p-5">
          <span className="flex-1 text-[#b42318]" role="alert">{error}</span>
          <GhostButton onClick={load}><RotateCcw size={14} /> Retry</GhostButton>
        </Card>
      </>
    );
  if (!rows) return <>{header}<Skeleton className="h-64 w-full" /></>;
  if (rows.length === 0) return <>{header}<Empty icon={<Grid3x3 size={18} />} title="No class data yet" body="Once students have been through their vivas, the class picture appears here." /></>;

  const sorted = [...rows].sort((a, b) => pct(b.red, total(b)) - pct(a.red, total(a)));
  const secure = Math.round(rows.reduce((n, r) => n + (total(r) ? r.green / total(r) : 0), 0) / rows.length * 100);
  const hardest = sorted.filter((r) => dominant(r) === "red");
  const watch = sorted.filter((r) => dominant(r) === "amber");
  const struggling = sorted.filter((r) => dominant(r) !== "green").slice(0, 4);
  const ambiguous = [...clusters].filter((c) => c.status === "open").sort((a, b) => b.students.length - a.students.length).slice(0, 3);

  return (
    <>
      {header}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-ink2">Concepts tracked</p><p className="tnum mt-1 text-2xl font-semibold">{rows.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-ink2">Average secure</p><p className="tnum mt-1 text-2xl font-semibold">{secure}%</p></Card>
        <Card className="p-4"><p className="text-xs text-ink2">To address in class</p><p className="tnum mt-1 text-2xl font-semibold">{hardest.length}</p></Card>
      </div>

      {hardest.length > 0 && (
        <Card className="mb-5 border-[#f5c2bd] bg-[#fff8f7] p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-red" /> Worth addressing with the whole class</div>
          <ul className="space-y-1.5">
            {hardest.map((r) => <li key={r.concept} className="flex items-center gap-2"><Dot status="red" /><span className="flex-1 font-medium">{r.concept}</span><span className="tnum text-xs text-ink2">{r.red} of {total(r)} red</span></li>)}
          </ul>
          {watch.length > 0 && <p className="mt-3 text-sm text-ink2">Keep an eye on: {watch.map((r) => r.concept).join(", ")}.</p>}
        </Card>
      )}

      <Card className="mb-5 p-5">
        <h3 className="mb-4 text-sm font-semibold">Class heatmap</h3>
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.concept}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">{r.concept}<Pill status={dominant(r)}>{dominant(r) === "green" ? "Secure" : dominant(r) === "amber" ? "Watch" : "Needs attention"}</Pill></span>
                <span className="tnum text-xs text-ink2">{r.red} red · {r.amber} amber · {r.green} green</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded bg-[#efefec]" role="img" aria-label={`${r.concept}: ${r.red} red, ${r.amber} amber, ${r.green} green`}>
                {(["red", "amber", "green"] as const).map((s) => <div key={s} style={{ width: `${pct(r[s], total(r))}%`, background: STATUS_COLOR[s] }} />)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageSquareQuote size={16} /> From the class so far</div>
          {struggling.length === 0 ? <p className="text-ink2">Nothing stands out. The class is secure on every concept.</p> : (
            <ul className="space-y-3">
              {struggling.map((r) => <li key={r.concept} className="border-l-2 border-[#14284b] pl-3"><p className="text-sm font-medium">Your class struggles with {r.concept.toLowerCase()}.</p><p className="text-sm text-ink2">{r.red + r.amber} of {total(r)} students are not yet secure ({pct(r.red, total(r))}% red).</p></li>)}
            </ul>
          )}
        </Card>
        <Card className="border-[#e8a33d66] bg-[#fffaf0] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-amber-ink" /> Your brief is ambiguous</div>
          {ambiguous.length === 0 ? <p className="text-ink2">No open questions about the brief.</p> : (
            <ul className="space-y-2">
              {ambiguous.map((c) => <li key={c.id} className="flex items-center gap-3"><span className="flex-1">{c.summary}</span><span className="tnum rounded bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ring-[#e8a33d66]">{c.students.length} students</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
