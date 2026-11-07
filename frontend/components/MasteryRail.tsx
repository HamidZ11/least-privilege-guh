"use client";

import { ConceptTile, Legend } from "./MasteryMap";
import { Card } from "./ui";
import type { Concept } from "@/lib/types";

/** Right-hand rail on Teach Max and Viva. Same tiles as the My progress map, so colour changes animate. */
export default function MasteryRail({ concepts, activeId, title = "Mastery map" }: { concepts: Concept[]; activeId: string | null; title?: string }) {
  const done = concepts.filter((c) => c.status === "green").length;
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="tnum shrink-0 text-xs text-ink2">{done}/{concepts.length} secure</span>
      </div>
      {concepts.length === 0 ? (
        <p className="py-4 text-sm text-ink2">Concepts appear here once your work has been read.</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-1">
          {concepts.map((c) => <ConceptTile key={c.id} compact c={{ id: c.id, name: c.name, status: c.status }} active={activeId === c.id} />)}
        </div>
      )}
      <div className="mt-3 border-t border-line pt-3"><Legend /></div>
    </Card>
  );
}
