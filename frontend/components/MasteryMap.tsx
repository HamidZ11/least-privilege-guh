"use client";

import Link from "next/link";
import { STATUS_COLOR, STATUS_LABEL } from "./ui";
import type { Status } from "@/lib/types";

export type MapConcept = { id: string; name: string; status: Status; href?: string };
export type MapRow = { key: string; label: string; sub?: string; concepts: MapConcept[]; source?: "live" | "seed" };

const HEX = "50,3 93,27 93,73 50,97 7,73 7,27";

/** One concept: hexagon with a centred, wrapped label underneath. Animates when its status changes. */
export function ConceptTile({ c, active, compact }: { c: MapConcept; active?: boolean; compact?: boolean }) {
  const color = STATUS_COLOR[c.status];
  const practise = c.status === "red" || c.status === "amber";
  const body = (
    <>
      <svg viewBox="0 0 100 100" className={compact ? "h-10 w-10" : "h-14 w-14"} aria-hidden>
        <polygon
          points={HEX}
          fill={color}
          fillOpacity={c.status === "untested" ? 0.25 : 0.2}
          stroke={color}
          strokeWidth={active ? 7 : 4}
          strokeLinejoin="round"
          style={{ transition: "fill 180ms ease, stroke 180ms ease, fill-opacity 180ms ease, stroke-width 180ms ease" }}
        />
        <circle cx="50" cy="50" r="11" fill={color} style={{ transition: "fill 180ms ease" }} />
      </svg>
      <span
        title={c.name}
        className={`line-clamp-2 break-words text-center leading-tight ${compact ? "w-[96px] text-[11px]" : "w-[120px] text-xs"} ${active ? "font-semibold text-ink" : "text-ink2"}`}
      >
        {c.name}
      </span>
    </>
  );
  const cls = "group relative flex flex-col items-center gap-1 rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-[#111111]";
  const tip = (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-48 -translate-x-1/2 rounded border border-line bg-white p-2.5 text-left text-xs shadow-lg group-hover:block group-focus-visible:block"
    >
      <span className="block font-semibold text-ink">{c.name}</span>
      <span className="mt-0.5 flex items-center gap-1.5 text-ink2"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{STATUS_LABEL[c.status]}</span>
      {practise && c.href && <span className="mt-1 block font-medium text-[#111111]">Practise with Max →</span>}
    </span>
  );
  return c.href && practise ? (
    <Link href={c.href} className={cls} aria-label={`${c.name}: ${STATUS_LABEL[c.status]}. Practise with Max`}>{body}{tip}</Link>
  ) : (
    <button type="button" className={`${cls} cursor-default`} aria-label={`${c.name}: ${STATUS_LABEL[c.status]}`}>{body}{tip}</button>
  );
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink2" aria-label="Legend">
      {([["green", "Secure"], ["amber", "Getting there"], ["red", "To work on"], ["untested", "Not tried"]] as const).map(([s, l]) => (
        <li key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{l}</li>
      ))}
    </ul>
  );
}

/** Rows of concepts, one per week. Labels never overlap: fixed-width tiles that wrap. */
export default function MasteryMap({ rows, activeId }: { rows: MapRow[]; activeId?: string | null }) {
  return (
    <div>
      <div className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4 first:pt-0">
            <div className="shrink-0 sm:w-36">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink3">{r.label}</p>
              {r.sub && <p className="text-sm text-ink2">{r.sub}</p>}
              {r.source && <p className="mt-0.5 text-[11px] text-ink3">{r.source === "live" ? "Live from your session" : "Seed data"}</p>}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-1">
              {r.concepts.map((c) => <ConceptTile key={c.id} c={c} active={activeId === c.id} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-line pt-3"><Legend /></div>
    </div>
  );
}
