"use client";

import { STATUS_COLOR } from "./ui";
import type { Status } from "@/lib/types";

export type HexItem = { id: string; label: string; status: Status; sub?: string };

const R = 34; // hex radius
const W = Math.sqrt(3) * R;

function hexPoints(cx: number, cy: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`;
  }).join(" ");
}

/** Honeycomb of hexagons. Status colour changes animate. Signature element. */
export default function HexMap({ items, cols = 3, activeId }: { items: HexItem[]; cols?: number; activeId?: string | null }) {
  const rows = Math.ceil(items.length / cols);
  const width = W * cols + W / 2 + 8;
  const height = rows * R * 1.5 + R * 0.5 + 8 + rows * 22;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Mastery map">
      {items.map((it, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const cx = 4 + W / 2 + col * W + (row % 2 ? W / 2 : 0);
        const cy = 4 + R + row * (R * 1.5 + 22);
        const color = STATUS_COLOR[it.status];
        return (
          <g key={it.id}>
            <polygon
              points={hexPoints(cx, cy)}
              fill={color}
              fillOpacity={it.status === "untested" ? 0.35 : 0.18}
              stroke={color}
              strokeWidth={activeId === it.id ? 3 : 1.5}
              style={{ transition: "fill 0.5s, stroke 0.5s, fill-opacity 0.5s" }}
            >
              <title>{`${it.label}: ${it.status}`}</title>
            </polygon>
            <circle cx={cx} cy={cy} r={6} fill={color} style={{ transition: "fill 0.5s" }} />
            <text x={cx} y={cy + R + 14} textAnchor="middle" fontSize="9.5" fill="#6b6b6b">
              {it.label.length > 18 ? it.label.slice(0, 17) + "…" : it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
