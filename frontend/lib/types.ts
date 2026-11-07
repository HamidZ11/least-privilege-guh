// Shared contract (prompt.md section 7). Do not change without telling the team.
export type Status = "untested" | "red" | "amber" | "green";
export type Concept = { id: string; name: string; claim: string; quote: string; status: Status; confidence: number };
export type RubricCriterion = {
  id: string;
  criterion: string;
  weight: number;
  status: "green" | "amber" | "red";
  gap_note: string;
  quote: string | null;
  confidence: number;
};
export type Flag = {
  type: "injection" | "contradicts_submission" | "cannot_explain" | "low_confidence";
  severity: "info" | "warn" | "high";
  detail: string;
  evidence_quote: string;
  transcript_index: number | null;
};
export type Turn = { role: "examiner" | "student" | "max"; text: string; concept_id: string | null; confidence?: number };
export type Mode = "viva" | "teach_max" | "recap" | "done";
export type Session = {
  id: string;
  student: string;
  module: string;
  mode: Mode;
  concepts: Concept[];
  rubric: RubricCriterion[];
  viva_transcript: Turn[];
  max_transcript: Turn[];
  flags: Flag[];
  current_concept_id: string | null;
  viva_started_at: string | null;
  revise: string[];
};
export type BriefAnswer = {
  status: "answered" | "escalated";
  answer: string | null;
  citation: string | null;
  confidence: number;
  cluster_id: string | null;
  cluster_size: number;
};
export type Cluster = {
  id: string;
  summary: string;
  questions: string[];
  students: string[];
  status: "open" | "answered";
  lecturer_answer: string | null;
  suggested_clarification: string | null;
};
export type HeatmapRow = { concept: string; red: number; amber: number; green: number };
export type GuardianEvent = {
  ts: string;
  agent: string;
  action: "input_scanned" | "injection_blocked" | "output_blocked" | "escalated" | "passed";
  detail: string;
};
export type AgentCard = { name: string; role: string; calls: number; last_action: string };
