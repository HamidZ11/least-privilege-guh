// API client for the Viva endpoints. Every call falls back to local demo logic
// if the backend is unreachable, so the UI never shows a blank or broken screen.
import { AGENTS_FIXTURE, BRIEF_ESCALATED, CLUSTERS_FIXTURE, HEATMAP_FIXTURE, SESSION_FIXTURE } from "./fixtures";
import { KW_REGISTRY, MODULE_RUBRIC_TEXT, type Lab } from "./course";
import type {
  AgentCard, BriefAnswer, Cluster, GuardianEvent, HeatmapRow, RubricCriterion, Session, Status, Turn,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

async function call<T>(path: string, init: RequestInit | undefined, fallback: () => T): Promise<{ data: T; live: boolean }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`${API}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return { data: (await res.json()) as T, live: true };
  } catch {
    return { data: fallback(), live: false };
  } finally {
    clearTimeout(t);
  }
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- local marker (used only when the backend is down) ---------- */
let mockClusters: Cluster[] = clone(CLUSTERS_FIXTURE);
const nextWeak = (s: Session) =>
  s.concepts.find((c) => c.status === "red") ?? s.concepts.find((c) => c.status === "amber") ?? s.concepts.find((c) => c.status === "untested");

const grade = (text: string, id: string): { status: Status; confidence: number } => {
  const t = text.toLowerCase();
  const src = KW_REGISTRY[id];
  const ok = src ? new RegExp(src).test(t) : t.length > 40 && !/(don'?t know|no idea)/.test(t);
  return ok ? { status: "green", confidence: 0.88 } : { status: "red", confidence: 0.8 };
};
const maxLine = (c: { name: string; quote: string }) =>
  `Hey! I was going through the lab notes and I'm pretty sure of this: "${c.quote}" That's right, isn't it? Can you check me on ${c.name.toLowerCase()}?`;

/* ---------- student ---------- */
export async function submitWork(student: string, work: string, rubric: string = MODULE_RUBRIC_TEXT) {
  const form = new FormData();
  form.append("student", student);
  form.append("work_text", work);
  form.append("rubric_text", rubric);
  return call<Session>("/api/submit", { method: "POST", body: form }, () => ({
    ...clone(SESSION_FIXTURE), student, viva_transcript: [], max_transcript: [],
  })).then(async (r) => { if (!r.live) await delay(1400); return r; });
}

/** Weekly lab feedback: real Checker if the backend is up, otherwise a simple local check. */
export async function checkLab(student: string, notes: string, lab: Lab): Promise<{ rubric: RubricCriterion[]; live: boolean }> {
  const objectives = lab.concepts.map((c) => `${c.name} (${Math.round(100 / lab.concepts.length)}%): ${c.claim}`).join("\n");
  const r = await submitWork(student, notes, objectives);
  if (r.live && r.data.rubric.length) return { rubric: r.data.rubric, live: true };
  const sentences = notes.split(/(?<=[.!?])\s+/);
  const rubric = lab.concepts.map((c, i): RubricCriterion => {
    const re = new RegExp(c.kw ?? "$^", "i");
    const hit = sentences.find((s) => re.test(s)) ?? null;
    const strong = hit && /(because|therefore|which means|so |however|but )/i.test(hit);
    const status = hit ? (strong ? "green" : "amber") : "red";
    return {
      id: `${lab.id}-${i}`, criterion: c.name, weight: Math.round(100 / lab.concepts.length), status,
      gap_note:
        status === "green" ? "You explain this in your own words and give a reason. Nice."
        : status === "amber" ? `You mention it, but not why it matters. Aim for: ${c.claim}`
        : `This isn't in your notes yet. Key idea from the lab: ${c.claim}`,
      quote: hit, confidence: hit ? 0.8 : 0.72,
    };
  });
  await delay(1000);
  return { rubric, live: false };
}

export async function chat(kind: "viva" | "max", session: Session, text: string | null) {
  return call<Session>(`/api/session/${session.id}/${kind}`, json({ text }), () => {
    const s = clone(session);
    const key = kind === "viva" ? "viva_transcript" : "max_transcript";
    const tr: Turn[] = s[key];
    if (kind === "viva" && !s.viva_started_at) s.viva_started_at = new Date().toISOString();
    if (text) tr.push({ role: "student", text, concept_id: s.current_concept_id });
    const cur = s.concepts.find((c) => c.id === s.current_concept_id);
    if (text && cur) {
      const g = grade(text, cur.id);
      if (kind === "max") { cur.status = g.status === "green" ? "green" : cur.status === "untested" ? "red" : cur.status; }
      else { cur.status = g.status; cur.confidence = g.confidence; }
      tr[tr.length - 1].confidence = g.confidence;
    }
    const studentTurns = tr.filter((t) => t.role === "student").length;
    if (kind === "max") {
      const nxt = nextWeak(s);
      if (cur && cur.status === "green" && text) {
        tr.push({ role: "max", text: `Ohh, that makes sense. I had "${cur.name.toLowerCase()}" the wrong way round. Thank you!`, concept_id: cur.id });
      } else if (cur && text) {
        tr.push({ role: "max", text: "Hmm, I'm still not sure. Can you explain it a different way? Why wouldn't it hold up?", concept_id: cur.id });
      }
      const target = text && cur?.status !== "green" ? cur : nxt;
      if (target && (!text || cur?.status === "green")) {
        s.current_concept_id = target.id;
        tr.push({ role: "max", text: maxLine(target), concept_id: target.id });
      } else if (!target) {
        tr.push({ role: "max", text: text ? "That's everything I had wrong. You've taught me loads!" : "I've got nothing wrong in this lab, you've already got it. Try another week?", concept_id: null });
      }
    } else {
      if (studentTurns >= 6 || (text && !s.concepts.some((c) => c.status === "untested"))) {
        s.mode = "recap";
        s.revise = s.concepts.filter((c) => c.status !== "green").map((c) => `Revisit: ${c.name}`).slice(0, 3);
        if (!s.revise.length) s.revise = ["Nothing urgent. Keep checking your sources."];
        tr.push({ role: "examiner", text: "That's the viva done. Thank you. Your answers are now with your module leader, who makes the final decision.", concept_id: null });
      } else {
        const nxt = s.concepts.find((c) => c.status === "untested") ?? s.concepts[0];
        s.current_concept_id = nxt.id;
        tr.push({ role: "examiner", text: `You wrote: "${nxt.quote}" Walk me through why.`, concept_id: nxt.id });
      }
    }
    return clone(s);
  }).then(async (r) => { if (!r.live) await delay(700); return r; });
}

export async function rephrase(session: Session) {
  return call<Session>(`/api/session/${session.id}/rephrase`, json({ mode: "plain" }), () => {
    const s = clone(session);
    s.viva_transcript.push({ role: "examiner", text: "In simpler words: can you explain, in your own words, what the study can and can't tell us?", concept_id: s.current_concept_id });
    return s;
  });
}

export const getBrief = () => call<{ text: string }>("/api/brief", undefined, () => ({ text: "" }));

export async function askBrief(student: string, question: string) {
  return call<BriefAnswer>("/api/brief/ask", json({ student, question }), () => {
    const q = question.toLowerCase();
    if (/(deadline|due|when|submit|moodle)/.test(q))
      return { status: "answered", answer: "Submit via Moodle by 23:59 on Friday 20 November 2026.", citation: "Submit via Moodle by 23:59 on Friday 20 November 2026.", confidence: 0.97, cluster_id: null, cluster_size: 0 };
    if (/(how many|sources|five)/.test(q))
      return { status: "answered", answer: "You need at least five academic sources.", citation: "You must use at least five academic sources.", confidence: 0.95, cluster_id: null, cluster_size: 0 };
    return clone(BRIEF_ESCALATED);
  }).then(async (r) => { if (!r.live) await delay(900); return r; });
}

export const getBroadcasts = (student: string) =>
  call<Cluster[]>(`/api/brief/broadcasts?student=${encodeURIComponent(student)}`, undefined, () => mockClusters.filter((c) => c.status === "answered"));

/* ---------- lecturer ---------- */
export const getQueue = () => call<Cluster[]>("/api/lecturer/queue", undefined, () => clone(mockClusters));
export const answerCluster = (cluster_id: string, text: string) =>
  call<Cluster>("/api/lecturer/answer", json({ cluster_id, text }), () => {
    mockClusters = mockClusters.map((c) => (c.id === cluster_id ? { ...c, status: "answered", lecturer_answer: text } : c));
    return clone(mockClusters.find((c) => c.id === cluster_id)!);
  });
export const getHeatmap = () => call<HeatmapRow[]>("/api/lecturer/heatmap", undefined, () => clone(HEATMAP_FIXTURE));
export const getAgents = () =>
  call<{ agents: AgentCard[]; log: GuardianEvent[] }>("/api/agents", undefined, () => clone(AGENTS_FIXTURE));

export type VoiceSource = "elevenlabs" | "browser" | "none";
let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  try { currentAudio?.pause(); currentAudio = null; } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

/**
 * Speaks `text` and resolves when it has finished.
 * Uses ElevenLabs through the backend (/api/tts, the API key never reaches the browser),
 * and falls back to the browser's own en-GB voice if the backend or key is unavailable.
 */
export async function speak(text: string, voice: "examiner" | "max"): Promise<VoiceSource> {
  stopSpeaking();
  try {
    const res = await fetch(`${API}/api/tts`, json({ text, voice }));
    if (res.ok && (res.headers.get("content-type") ?? "").includes("audio")) {
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      currentAudio = audio;
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("audio"));
        audio.play().catch(reject);
      });
      return "elevenlabs";
    }
  } catch { /* fall through to browser voice */ }
  try {
    if (!("speechSynthesis" in window)) return "none";
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
      u.pitch = voice === "max" ? 1.15 : 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
    return "browser";
  } catch { return "none"; }
}
