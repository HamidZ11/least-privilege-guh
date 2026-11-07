"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, Bell, BookOpen, ClipboardCheck, FlaskConical, Grid3x3, Inbox, LayoutDashboard,
  MessageCircle, Upload, Users, type LucideIcon,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { NotifBadge } from "./ui";

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };

function Crest() {
  // Simple shield mark, not a real university crest.
  return (
    <svg width="19" height="23" viewBox="0 0 30 34" aria-hidden>
      <path d="M15 1 28 6v11c0 8-6 13.5-13 16C8 30.500 2 25 2 17V6Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 11l6 11 6-11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    <div className="viva-frame flex">
      <aside className="viva-sidebar no-print flex min-h-0 shrink-0 flex-col border-r border-line bg-[#fafafa]" aria-label="Module menu">
        <div className="flex h-[60px] shrink-0 items-center gap-2.5 px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-white"><Crest /></span>
          <span className="text-base font-semibold tracking-tight">Viva</span>
          <span className="ml-auto rounded border border-line bg-white px-1.5 py-0.5 text-[10px] text-ink2">CMP2045</span>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2">
          {groups.map((g) => (
            <div key={g.label} className="mb-6">
              <p className="px-3 pb-2 text-xs text-[#8a8a8a]">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = path === it.href || path.startsWith(it.href + "/");
                  const Icon = it.icon;
                  return (
                    <li key={it.href}>
                      <Link href={it.href} aria-current={active ? "page" : undefined}
                        className={`flex min-h-8 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? "bg-[#f0f0f0] font-medium text-ink" : "text-ink2 hover:bg-[#f3f3f3] hover:text-ink"}`}>
                        <Icon size={16} strokeWidth={1.5} />
                        <span className="viva-nav-label min-w-0 flex-1">{it.label}</span>
                        {it.href === "/lecturer/escalations" ? <NotifBadge count={it.badge ?? 0} /> : !!it.badge && <span className="tnum text-xs text-ink2">{it.badge}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <p className="px-4 pb-2 text-xs text-ink2">Demo mode · view as</p>
        <div className="mx-3 mb-3 flex rounded-lg border border-line bg-[#f0f0f0] p-0.5 text-xs" role="tablist" aria-label="Demo mode: view as">
          {(["student", "lecturer"] as const).map((r) => (
            <button key={r} role="tab" aria-selected={role === r} onClick={() => switchRole(r)}
              className={`flex-1 rounded-md px-2 py-1.5 capitalize transition-colors ${role === r ? "bg-white font-medium text-ink shadow-sm" : "text-ink2 hover:text-ink"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2.5 border-t border-line px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-xs font-medium">{role === "student" ? "AK" : "ML"}</span>
          <div className="min-w-0"><p className="truncate text-[13px] font-medium">{role === "student" ? "Aisha Khan" : "Module leader"}</p><p className="text-xs text-ink2">CMP2045 · Manchester</p></div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print relative z-30 flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-line bg-white px-6">
          <p className="truncate text-[13px] text-ink2">My modules <span className="mx-2 text-[#c5c5c5]">/</span> CMP2045 <span className="mx-2 text-[#c5c5c5]">/</span><span className="text-ink">{current}</span></p>
          <div className="relative">
            <button onClick={() => setBell((b) => !b)} aria-label={`Notifications, ${unread} unread`} aria-expanded={bell} className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink2 hover:bg-[#f5f5f5]">
              <Bell size={16} />
              {unread > 0 && <span className="absolute -right-1 -top-1"><NotifBadge count={unread} /></span>}
            </button>
            {bell && (
              <div className="absolute right-0 top-10 w-80 max-w-[calc(100vw-48px)] rounded-xl border border-line bg-white text-ink shadow-lg">
                <p className="border-b border-line px-4 py-3 text-sm font-medium">Notifications</p>
                {mine.length === 0 && <p className="px-4 py-6 text-center text-ink2">You&apos;re all caught up.</p>}
                <ul className="max-h-80 overflow-y-auto">
                  {mine.slice(0, 8).map((n) => (
                    <li key={n.id}><button onClick={() => { setBell(false); router.push(n.href); }} className="flex w-full items-start gap-2.5 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-[#fafafa]">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-red"}`} />
                      <span className="min-w-0 flex-1"><span className="block text-[13px]">{n.text}</span><span className="text-xs text-ink2">{ago(n.at)}</span></span>
                    </button></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </header>
        <main className="viva-main min-h-0 min-w-0 flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
