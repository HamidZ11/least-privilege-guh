"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getQueue } from "@/lib/viva";
import {
  SEED_ASSESSMENTS, SEED_LABS, SEED_MASTERY, registerLabs,
  type Assessment, type Decision, type Lab, type Notif, type Role,
} from "@/lib/course";
import type { Cluster, Session, Status } from "@/lib/types";

type Store = {
  labs: Lab[];
  mastery: Record<string, Status>;
  labSessions: Record<string, Session>;
  labFeedback: Record<string, Session["rubric"]>;
  assessments: Assessment[];
  notifs: Notif[];
};

const KEY = "viva-store-v2";
const fresh = (): Store => ({
  labs: SEED_LABS, mastery: { ...SEED_MASTERY }, labSessions: {}, labFeedback: {},
  assessments: structuredClone(SEED_ASSESSMENTS), notifs: [],
});

type Ctx = Store & {
  ready: boolean;
  role: Role;
  setRole: (r: Role) => void;
  student: string;
  clusters: Cluster[];
  refreshQueue: () => void;
  openEscalations: number;
  notify: (to: Role, text: string, href: string, sticky?: boolean) => void;
  markRead: (href: string, onlyNonSticky?: boolean) => void;
  unreadFor: (role: Role, hrefPrefix?: string) => number;
  uploadLab: (lab: Omit<Lab, "id" | "uploadedAt" | "isNew">) => void;
  setMasteryFor: (updates: Record<string, Status>) => void;
  saveLabSession: (s: Session) => void;
  saveLabFeedback: (labId: string, rubric: Session["rubric"]) => void;
  patchAssessment: (id: string, patch: Partial<Assessment>) => void;
  decide: (id: string, d: Decision) => void;
  resetDemo: () => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("student");
  const [store, setStore] = useState<Store>(fresh);
  const [ready, setReady] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);

  const refreshQueue = useCallback(() => { getQueue().then((r) => setClusters(r.data)); }, []);

  useEffect(() => {
    refreshQueue();
    try {
      const r = localStorage.getItem("viva-role");
      if (r === "lecturer" || r === "student") setRoleState(r);
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Store;
        registerLabs(s.labs);
        setStore(s);
      }
    } catch { /* start fresh */ }
    setReady(true);
  }, [refreshQueue]);

  // Persist and sync across tabs (so a lecturer tab and a student tab stay in step).
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ }
  }, [store, ready]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try { const s = JSON.parse(e.newValue) as Store; registerLabs(s.labs); setStore(s); } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    try { localStorage.setItem("viva-role", r); } catch { /* ignore */ }
  };

  const update = (fn: (s: Store) => Store) => setStore((s) => fn(s));

  const notify: Ctx["notify"] = (to, text, href, sticky) =>
    update((s) => ({ ...s, notifs: [{ id: crypto.randomUUID(), to, text, href, at: Date.now(), read: false, sticky }, ...s.notifs].slice(0, 40) }));

  const markRead: Ctx["markRead"] = (href, onlyNonSticky) =>
    update((s) => ({
      ...s,
      notifs: s.notifs.map((n) => (n.href === href && !n.read && !(onlyNonSticky && n.sticky) ? { ...n, read: true } : n)),
    }));

  const unreadFor: Ctx["unreadFor"] = (r, prefix) =>
    store.notifs.filter((n) => n.to === r && !n.read && (!prefix || n.href.startsWith(prefix))).length;

  const value: Ctx = useMemo(() => ({
    ...store, ready, role, setRole, student: "Aisha Khan", clusters, refreshQueue,
    openEscalations: clusters.filter((c) => c.status === "open").length,
    notify, markRead, unreadFor,
    uploadLab: (lab) => {
      registerLabs([lab as Lab]);
      const id = `lab${Date.now()}`;
      update((s) => ({ ...s, labs: [...s.labs, { ...lab, id, uploadedAt: `Week ${lab.week}`, isNew: true }] }));
      notify("student", `New weekly lab: Week ${lab.week}, ${lab.title}. Max is ready to practise it with you.`, "/teach");
    },
    setMasteryFor: (u) => update((s) => ({ ...s, mastery: { ...s.mastery, ...u } })),
    saveLabSession: (sess) => update((s) => ({ ...s, labSessions: { ...s.labSessions, [sess.id]: sess } })),
    saveLabFeedback: (labId, rubric) => update((s) => ({ ...s, labFeedback: { ...s.labFeedback, [labId]: rubric } })),
    patchAssessment: (id, patch) => update((s) => ({ ...s, assessments: s.assessments.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
    decide: (id, d) => update((s) => ({ ...s, assessments: s.assessments.map((a) => (a.id === id ? { ...a, status: "reviewed", decision: d } : a)) })),
    resetDemo: () => { const f = fresh(); registerLabs(f.labs); setStore(f); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [store, ready, role, clusters, refreshQueue]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
