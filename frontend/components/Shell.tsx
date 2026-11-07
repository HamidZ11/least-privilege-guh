"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, Bell, BookOpen, ClipboardCheck, ClipboardList, FlaskConical, Grid3x3, Inbox, LayoutDashboard,
  MessageCircle, ShieldCheck, Upload, Users, type LucideIcon,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { NotifBadge } from "./ui";

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };

function Crest() {
  // Simple shield mark, not a real university crest.
  return (
    <svg width="30" height="34" viewBox="0 0 30 34" aria-hidden>
      <path d="M15 1 28 6v11c0 8-6 13.5-13 16C8 30.500 2 25 2 17V6Z" fill="none" stroke="#d4b25a" strokeWidth="1.8" />
      <path d="M9 11l6 11 6-11" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ago = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default function Shell({ children }: { children: React.ReactNode }) {
  const { role, setRole, openEscalations, unreadFor, notifs, markRead, assessments } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [bell, setBell] = useState(false);

  // Visiting a page clears its (non-sticky) notifications.
  useEffect(() => { markRead(path, true); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const vivaDue = assessments.filter((a) => a.status === "viva_due").length;
  const groups: { label: string; items: Item[] }[] =
    role === "student"
      ? [
          { label: "Assessment", items: [
            { href: "/brief", label: "Assignment brief", icon: BookOpen, badge: unreadFor("student", "/brief") },
            { href: "/submit", label: "Submit work", icon: Upload, badge: vivaDue },
            { href: "/rubric", label: "Feedback", icon: ClipboardCheck, badge: unreadFor("student", "/rubric") },
          ] },
          { label: "Weekly labs", items: [
            { href: "/teach", label: "Teach Max", icon: MessageCircle, badge: unreadFor("student", "/teach") },
            { href: "/overview", label: "My progress", icon: LayoutDashboard },
          ] },
        ]
      : [
          { label: "Module leader", items: [
            { href: "/lecturer/escalations", label: "Student questions", icon: Inbox, badge: openEscalations },
            { href: "/lecturer/labs", label: "Weekly labs", icon: FlaskConical },
            { href: "/lecturer/assessments", label: "Assessments", icon: ClipboardList },
            { href: "/lecturer/reports", label: "Viva reports", icon: Users, badge: unreadFor("lecturer", "/lecturer/reports") },
            { href: "/lecturer/heatmap", label: "Class insights", icon: Grid3x3 },
            { href: "/lecturer/agents", label: "AI agents & audit log", icon: Activity },
          ] },
        ];

  const current = groups.flatMap((g) => g.items).find((i) => path === i.href || path.startsWith(i.href + "/"))?.label ?? "Viva";
  const mine = notifs.filter((n) => n.to === role);
  const unread = mine.filter((n) => !n.read).length;
  const switchRole = (r: typeof role) => {
    setRole(r);
    router.push(r === "student" ? "/brief" : "/lecturer/escalations");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="no-print relative z-30 shrink-0 border-b-[3px] border-[#d4b25a] bg-[#14284b] text-white">
        <div className="flex h-14 items-center gap-4 px-5">
          <Crest />
          <div className="leading-tight">
            <p className="font-serif text-lg font-semibold tracking-tight">Viva</p>
            <p className="text-[11px] uppercase tracking-widest text-white/60">Assessment &amp; understanding</p>
          </div>
          <span className="mx-3 hidden h-7 w-px bg-white/20 md:block" />
          <p className="hidden text-sm text-white/80 md:block">University of Manchester</p>
          <div className="flex-1" />

          <div className="relative">
            <button onClick={() => setBell((b) => !b)} aria-label={`Notifications, ${unread} unread`} aria-expanded={bell} className="relative rounded p-2 hover:bg-white/10">
              <Bell size={18} />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5"><NotifBadge count={unread} /></span>}
            </button>
            {bell && (
              <div className="absolute right-0 mt-2 w-80 rounded-md border border-line bg-white text-ink shadow-lg">
                <p className="border-b border-line px-4 py-2.5 text-sm font-semibold">Notifications</p>
                {mine.length === 0 && <p className="px-4 py-6 text-center text-ink2">You&apos;re all caught up.</p>}
                <ul className="max-h-80 overflow-y-auto">
                  {mine.slice(0, 8).map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => { setBell(false); router.push(n.href); }}
                        className="flex w-full items-start gap-2.5 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-[#f6f7fa]"
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-[#e5372a]"}`} />
                        <span className="flex-1"><span className="block text-sm">{n.text}</span><span className="text-xs text-ink3">{ago(n.at)}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex rounded border border-white/25 text-sm" role="tablist" aria-label="View as">
            {(["student", "lecturer"] as const).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={role === r}
                onClick={() => switchRole(r)}
                className={`px-3 py-1.5 capitalize transition-colors ${role === r ? "bg-white font-semibold text-[#14284b]" : "text-white/80 hover:bg-white/10"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">{role === "student" ? "AK" : "ML"}</span>
            <span className="text-sm">{role === "student" ? "Aisha Khan" : "Module leader"}</span>
          </div>
        </div>
      </header>

      <div className="no-print shrink-0 border-b border-line bg-white px-6 py-3">
        <p className="text-xs text-ink2">
          Home <span className="mx-1">/</span> My modules <span className="mx-1">/</span> CMP2045 <span className="mx-1">/</span>
          <span className="text-ink">{current}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-serif text-xl font-semibold text-[#14284b]">CMP2045 Research Methods in Psychology</h2>
          <span className="text-sm text-ink2">Year 2 · Weekly labs · Quizzes and final piece</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="no-print flex w-60 shrink-0 flex-col border-r border-line bg-white" aria-label="Module menu">
          <nav className="flex-1 overflow-y-auto py-4">
            {groups.map((g) => (
              <div key={g.label} className="mb-5">
                <p className="px-5 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink3">{g.label}</p>
                <ul>
                  {g.items.map((it) => {
                    const active = path === it.href || path.startsWith(it.href + "/");
                    const Icon = it.icon;
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-3 border-l-[3px] px-5 py-2 transition-colors ${active ? "border-[#14284b] bg-[#eef1f7] font-semibold text-[#14284b]" : "border-transparent text-ink hover:bg-[#f6f7fa]"}`}
                        >
                          <Icon size={16} className={active ? "" : "text-ink2"} />
                          <span className="flex-1">{it.label}</span>
                          <NotifBadge count={it.badge ?? 0} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="flex items-start gap-2 border-t border-line bg-[#f6f7fa] px-5 py-3 text-xs text-ink2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#14284b]" />
            <span>A learning check, not a grade. A person makes every decision.</span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-[#f2f4f8] p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
