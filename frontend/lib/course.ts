// Frontend-only course model: weekly labs, assessments, notifications.
// The backend has no endpoints for these yet (see design/refs/what_i_changed.md).
import { SESSION_FIXTURE } from "./fixtures";
import type { Concept, Session, Status } from "./types";

export type LabConcept = { id: string; name: string; claim: string; misconception: string; kw?: string };
export type Lab = {
  id: string;
  week: number;
  title: string;
  summary: string;
  concepts: LabConcept[];
  uploadedAt: string;
  fileName?: string;
  isNew?: boolean;
};

export const SEED_LABS: Lab[] = [
  {
    id: "lab1", week: 1, title: "Research designs", uploadedAt: "Week 1",
    summary: "Experimental vs observational designs, and what each can claim.",
    concepts: [
      { id: "l1a", name: "Experimental vs observational", claim: "Only experiments with random assignment can support causal claims.", misconception: "If we measure two things and they move together, that's an experiment, so we know one causes the other.", kw: "(random|manipulat|control group|observational|assign)" },
      { id: "l1b", name: "Cross-sectional vs longitudinal", claim: "A cross-sectional study is a snapshot and cannot show which came first.", misconception: "A cross-sectional study can tell us which came first, because everything was measured.", kw: "(one point|single point|snapshot|over time|direction|which came first|longitudinal)" },
    ],
  },
  {
    id: "lab2", week: 2, title: "Sampling", uploadedAt: "Week 2",
    summary: "Representative samples, sampling bias and generalising to a population.",
    concepts: [
      { id: "l2a", name: "Representative sampling", claim: "Representativeness depends on how people were selected, not just how many.", misconception: "A bigger sample is always a representative sample.", kw: "(represent|random|population|generali|selection)" },
      { id: "l2b", name: "Sampling bias", claim: "Volunteer and self-selected samples can be skewed however large they are.", misconception: "If lots of people answer a volunteer survey, bias stops mattering.", kw: "(bias|volunteer|self-select|non-?response|skew)" },
    ],
  },
  {
    id: "lab3", week: 3, title: "Measurement", uploadedAt: "Week 3",
    summary: "Reliability, validity and the limits of self-report.",
    concepts: [
      { id: "l3a", name: "Reliability vs validity", claim: "A measure can be consistent (reliable) without measuring the right thing (valid).", misconception: "If a measure gives the same result every time it must be valid.", kw: "(valid|measures what|consisten|reliab|accurate)" },
      { id: "l3b", name: "Self-report bias", claim: "Self-reports are affected by recall error and social desirability.", misconception: "Teenagers know exactly how long they spend online, so self-report is reliable.", kw: "(bias|social desirab|recall|inaccura|honest|over-?report|under-?report)" },
    ],
  },
  {
    id: "lab4", week: 4, title: "Causation", uploadedAt: "Week 4",
    summary: "Correlation vs causation, confounding and mediating variables.",
    concepts: [
      { id: "l4a", name: "Correlation vs causation", claim: "An association alone cannot show that one variable causes the other.", misconception: "A large sample proves that social media causes anxiety.", kw: "(association|correlat|not (prove|show)|doesn'?t (prove|show)|can'?t (prove|show)|confound|third variable)" },
      { id: "l4b", name: "Confounding & mediating variables", claim: "A third variable can explain, or sit on the path of, an observed link.", misconception: "Sleep can't matter here, the effect is a direct one.", kw: "(confound|mediat|third variable|sleep|explain|indirect)" },
    ],
  },
];

export const SEED_MASTERY: Record<string, Status> = {
  l1a: "green", l1b: "green", l2a: "green", l2b: "amber",
  l3a: "green", l3b: "amber", l4a: "red", l4b: "untested",
};

/** Regex sources used by the offline marker, filled from labs at runtime. */
export const KW_REGISTRY: Record<string, string> = {
  c1: "(association|correlat|not (prove|show)|doesn'?t (prove|show)|can'?t (prove|show)|direction|cross-sectional|confound)",
  c2: "(bias|social desirab|recall|inaccura|honest|over-?report|under-?report)",
  c3: "(one point|single point|direction|snapshot|over time)",
  c4: "(mediat|sleep|harass|esteem|explain)",
  c5: "(represent|generali|random|bias|large)",
};
export function registerLabs(labs: Lab[]) {
  for (const l of labs) for (const c of l.concepts) if (c.kw) KW_REGISTRY[c.id] = c.kw;
}
registerLabs(SEED_LABS);

export const labToConcepts = (lab: Lab, mastery: Record<string, Status>): Concept[] =>
  lab.concepts.map((c) => ({
    id: c.id, name: c.name, claim: c.claim, quote: c.misconception,
    status: mastery[c.id] ?? "untested", confidence: 0.85,
  }));

export function labSession(lab: Lab, student: string, mastery: Record<string, Status>): Session {
  const concepts = labToConcepts(lab, mastery);
  const weak = concepts.find((c) => c.status === "red") ?? concepts.find((c) => c.status === "amber") ?? concepts.find((c) => c.status === "untested") ?? concepts[0];
  return {
    id: `lab-${lab.id}`, student, module: "CMP2045", mode: "teach_max", concepts,
    rubric: [], viva_transcript: [], max_transcript: [], flags: [],
    current_concept_id: weak?.id ?? null, viva_started_at: null, revise: [],
  };
}

/* ---------- assessments ---------- */
export type AssessStatus = "not_started" | "viva_due" | "awaiting_review" | "reviewed";
export type Decision = { outcome: "satisfied" | "follow_up"; note: string; by: string };
export type Assessment = {
  id: string; title: string; kind: "quiz" | "final"; weight: number; due: string; linkedWeeks: number[];
  status: AssessStatus; workName?: string; session?: Session; decision?: Decision;
};

export const SEED_ASSESSMENTS: Assessment[] = [
  {
    id: "quiz1", title: "Quiz 1: Designs and sampling", kind: "quiz", weight: 10, due: "Fri 16 Oct 2026", linkedWeeks: [1, 2],
    status: "reviewed", workName: "quiz1-answers.txt",
    session: {
      ...structuredClone(SESSION_FIXTURE), id: "seed-quiz1", mode: "done",
      concepts: SEED_LABS.slice(0, 2).flatMap((l) => labToConcepts(l, { ...SEED_MASTERY })),
      rubric: [
        { id: "q1", criterion: "Critical analysis", weight: 40, status: "green", gap_note: "You weigh the strengths of random assignment against its practical limits.", quote: "random assignment lets us rule out many alternative explanations", confidence: 0.9 },
        { id: "q2", criterion: "Understanding of methods", weight: 30, status: "green", gap_note: "Sampling and design terms are used accurately.", quote: null, confidence: 0.88 },
        { id: "q3", criterion: "Use of sources", weight: 20, status: "amber", gap_note: "Two sources cited; add one more academic source for a full answer.", quote: null, confidence: 0.8 },
        { id: "q4", criterion: "Presentation", weight: 10, status: "green", gap_note: "Clear structure and consistent referencing.", quote: null, confidence: 0.82 },
      ],
      flags: [], revise: ["Sampling bias in volunteer samples"],
    },
    decision: { outcome: "satisfied", note: "Explained their answers fluently in the viva.", by: "Module leader" },
  },
  { id: "quiz2", title: "Quiz 2: Measurement and causation", kind: "quiz", weight: 10, due: "Fri 6 Nov 2026", linkedWeeks: [3, 4], status: "not_started" },
  { id: "final", title: "Final piece: Critical evaluation (1500 words)", kind: "final", weight: 40, due: "Fri 20 Nov 2026, 23:59", linkedWeeks: [1, 2, 3, 4], status: "not_started" },
];

export const MODULE_RUBRIC_TEXT = `Critical analysis (40%): evaluates strengths and limitations, judges whether conclusions follow from the evidence.
Understanding of methods (30%): correctly explains design, sampling and measurement, including their limitations.
Use of sources (20%): at least five academic sources, accurately cited, used to support the argument.
Presentation (10%): clear structure, academic tone, correct referencing style.`;

/** Local session for quizzes (the final piece goes through the backend pipeline). */
export function assessmentSession(a: Assessment, student: string, work: string): Session {
  const labs = SEED_LABS.filter((l) => a.linkedWeeks.includes(l.week));
  const sentences = work.split(/(?<=[.!?])\s+/).filter((s) => s.length > 25);
  const concepts: Concept[] = labs.flatMap((l) => l.concepts).map((c, i) => ({
    id: `${a.id}-${c.id}`, name: c.name, claim: c.claim,
    quote: sentences[i] ?? c.claim, status: "untested" as Status, confidence: 0.8,
  }));
  for (const c of concepts) KW_REGISTRY[c.id] = KW_REGISTRY[c.id.split("-").slice(1).join("-")] ?? "";
  const base = structuredClone(SESSION_FIXTURE);
  return {
    ...base, id: `quiz-${a.id}-${Date.now()}`, student, concepts, mode: "viva",
    viva_transcript: [], max_transcript: [], current_concept_id: concepts[0]?.id ?? null,
    viva_started_at: null, flags: [], revise: concepts.slice(0, 3).map((c) => `Revisit: ${c.name}`),
  };
}

/* ---------- notifications ---------- */
export type Role = "student" | "lecturer";
export type Notif = { id: string; to: Role; text: string; href: string; at: number; read: boolean; sticky?: boolean };

/* ---------- class-wide demo data (labelled in the UI) ---------- */
export type ClassTopic = { week: number; lab: string; concept: string; red: number; amber: number; green: number; quote?: string };
export const CLASS_TOPICS: ClassTopic[] = [
  { week: 1, lab: "Research designs", concept: "Experimental vs observational", red: 1, amber: 3, green: 16 },
  { week: 1, lab: "Research designs", concept: "Cross-sectional vs longitudinal", red: 4, amber: 6, green: 10, quote: "Students say a cross-sectional study shows which variable came first." },
  { week: 2, lab: "Sampling", concept: "Representative sampling", red: 2, amber: 4, green: 14 },
  { week: 2, lab: "Sampling", concept: "Sampling bias", red: 3, amber: 8, green: 9, quote: "Many assume a large volunteer sample cancels out bias." },
  { week: 3, lab: "Measurement", concept: "Reliability vs validity", red: 5, amber: 7, green: 8, quote: "The two terms are swapped in about a third of Max chats." },
  { week: 3, lab: "Measurement", concept: "Self-report bias", red: 5, amber: 9, green: 6, quote: "Students trust self-report because \"people know their own habits\"." },
  { week: 4, lab: "Causation", concept: "Correlation vs causation", red: 12, amber: 5, green: 3, quote: "12 of 20 repeated the same mistake with Max: \"a big sample proves causation\"." },
  { week: 4, lab: "Causation", concept: "Confounding & mediating variables", red: 6, amber: 8, green: 6, quote: "Students name mediators but miss confounders." },
];
export const topicStatus = (t: { red: number; amber: number; green: number }): Status =>
  t.red >= t.amber && t.red >= t.green ? "red" : t.amber >= t.green ? "amber" : "green";

/* ---------- backend session creation for labs ---------- */
/** Text sent to /api/submit so the backend Reader builds concepts (and Max) for a lab. */
export const labWorkText = (lab: Lab) =>
  `Week ${lab.week} lab: ${lab.title}\n${lab.summary}\n` + lab.concepts.map((c) => c.misconception).join("\n");
export const labRubricText = (lab: Lab) =>
  lab.concepts.map((c) => `${c.name} (${Math.round(100 / lab.concepts.length)}%): ${c.claim}`).join("\n");
