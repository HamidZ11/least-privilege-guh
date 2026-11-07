import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Status } from "@/lib/types";

export const STATUS_COLOR: Record<Status, string> = {
  green: "#2E9D5B", amber: "#E8A33D", red: "#D9483B", untested: "#C9C9C6",
};
export const STATUS_LABEL: Record<Status, string> = {
  green: "Met", amber: "Partly", red: "Missing", untested: "Not tested",
};

export function Dot({ status, size = 8 }: { status: Status; size?: number }) {
  return (
    <span
      aria-label={status}
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: STATUS_COLOR[status] }}
    />
  );
}

export function Pill({ status, children }: { status: Status; children?: ReactNode }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `${c}1f`, color: status === "untested" ? "#6b6b6b" : c }}
    >
      <Dot status={status} size={6} />
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}

export function Confidence({ value }: { value: number }) {
  return (
    <span className="tnum rounded-md border border-line px-1.5 py-0.5 text-xs text-ink2" title="How sure the AI is. Low confidence goes to a human.">
      {Math.round(value * 100)}% sure
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-line bg-white ${className}`}>{children}</div>;
}

export function PrimaryButton({ className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded bg-btn px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0d1c38] disabled:cursor-not-allowed disabled:bg-[#cfcfcc] ${className}`}
    />
  );
}

export function GhostButton({ className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:bg-[#f6f6f4] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f3f1] text-ink2">{icon}</div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-ink2">{body}</p>
      {action}
    </Card>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5 border-b border-line pb-3">
      <h1 className="text-2xl">{title}</h1>
      {sub && <p className="mt-1 text-ink2">{sub}</p>}
    </div>
  );
}

/** Small red notification bubble (iOS-style count badge). */
export function NotifBadge({ count, label = "notifications" }: { count: number; label?: string }) {
  if (!count) return null;
  return (
    <span
      className="tnum inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e5372a] px-1 text-[11px] font-bold leading-none text-white shadow-[0_0_0_2px_#fff]"
      aria-label={`${count} ${label}`}
    >
      {count}
    </span>
  );
}
