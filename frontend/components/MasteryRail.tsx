"use client";

import { useEffect, useRef, useState } from "react";
import HexMap from "./HexMap";
import { Card, Dot, STATUS_LABEL } from "./ui";
import type { Concept } from "@/lib/types";

export default function MasteryRail({ concepts, activeId, title = "Mastery map" }: { concepts: Concept[]; activeId: string | null; title?: string }) {
  const prev = useRef<Record<string, string>>({});
  const [changed, setChanged] = useState<string | null>(null);

  useEffect(() => {
    for (const c of concepts) {
      if (prev.current[c.id] && prev.current[c.id] !== c.status) {
        setChanged(c.id);
        const t = setTimeout(() => setChanged(null), 700);
        prev.current[c.id] = c.status;
        return () => clearTimeout(t);
      }
      prev.current[c.id] = c.status;
    }
  }, [concepts]);

  const done = concepts.filter((c) => c.status === "green").length;
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="tnum text-xs text-ink2">{done}/{concepts.length} secure</span>
      </div>
      <HexMap
        cols={2}
        activeId={activeId}
        items={concepts.map((c) => ({ id: c.id, label: c.name, status: c.status }))}
      />
      <ul className="mt-3 space-y-1.5">
        {concepts.map((c) => (
          <li key={c.id} className={`flex items-center gap-2 text-xs ${changed === c.id ? "pop" : ""}`}>
            <Dot status={c.status} />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="text-ink3">{STATUS_LABEL[c.status]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
