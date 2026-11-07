"""Pydantic models matching the shared contract (section 7 of the build prompt).
Do not change field names without telling the team."""

from typing import Literal

from pydantic import BaseModel, Field

Status = Literal["untested", "red", "amber", "green"]
RagStatus = Literal["green", "amber", "red"]
Mode = Literal["viva", "teach_max", "recap", "done"]


class Concept(BaseModel):
    id: str
    name: str
    claim: str
    quote: str
    status: Status = "untested"
    confidence: float = 0.0


class RubricCriterion(BaseModel):
    id: str
    criterion: str
    weight: float  # % of the mark
    status: RagStatus
    gap_note: str
    quote: str | None = None
    confidence: float


class Flag(BaseModel):
    type: Literal["injection", "contradicts_submission", "cannot_explain", "low_confidence"]
    severity: Literal["info", "warn", "high"]
    detail: str  # neutral wording, never an accusation
    evidence_quote: str
    transcript_index: int | None = None


class Turn(BaseModel):
    role: Literal["examiner", "student", "max"]
    text: str
    concept_id: str | None = None
    confidence: float | None = None


class Session(BaseModel):
    id: str
    student: str
    module: str
    mode: Mode = "viva"
    concepts: list[Concept] = Field(default_factory=list)
    rubric: list[RubricCriterion] = Field(default_factory=list)
    viva_transcript: list[Turn] = Field(default_factory=list)
    max_transcript: list[Turn] = Field(default_factory=list)
    flags: list[Flag] = Field(default_factory=list)
    current_concept_id: str | None = None
    viva_started_at: str | None = None
    revise: list[str] = Field(default_factory=list)


class BriefAnswer(BaseModel):
    status: Literal["answered", "escalated"]
    answer: str | None = None
    citation: str | None = None
    confidence: float = 0.0
    cluster_id: str | None = None
    cluster_size: int = 0


class Cluster(BaseModel):
    id: str
    summary: str
    questions: list[str] = Field(default_factory=list)
    students: list[str] = Field(default_factory=list)
    status: Literal["open", "answered"] = "open"
    lecturer_answer: str | None = None
    suggested_clarification: str | None = None


class HeatmapRow(BaseModel):
    concept: str
    red: int
    amber: int
    green: int


class GuardianEvent(BaseModel):
    ts: str
    agent: str
    action: Literal["input_scanned", "injection_blocked", "output_blocked", "escalated", "passed"]
    detail: str


class AgentCard(BaseModel):
    name: str
    role: str
    calls: int
    last_action: str
