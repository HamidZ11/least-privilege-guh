"""Brief Q&A. Answers are exact sentences from the assignment brief.

If the brief does not state the policy, the question is clustered and escalated.
The same underlying ambiguity shares one cluster. A student is counted once.
"""

import hashlib
import re
from app.agents.guardian import note_agent, scan_input, should_escalate

_REFERENCES = "cl-word-limit-references"
_GAP = "The brief does not say whether the reference list counts toward the 1500 words."
_GENERIC_GAP = "The brief does not state a policy that answers this question."

# Exact substrings of BRIEF. If a line is not in that text, we escalate
# rather than invent a citation.
QUOTES = {
    "source_count": "You must use five academic sources.",
    "word_limit": (
        "Write a 1500-word critical evaluation of social media use and adolescent anxiety."
    ),
    "learning_outcomes": (
        "Evaluate claims about social media use and adolescent anxiety, judge whether "
        "a study design supports those claims, and use academic sources in a critical argument."
    ),
    "deadline": "Submit by 18 December 2026 at 14:00 UK time.",
    "module": "CMP2045 Research Methods in Psychology, University of Manchester.",
    "weighting": "This assignment is worth 40% of the module mark.",
}

ANSWER_CONFIDENCE = 0.93
ESCALATE_CONFIDENCE = 0.22
CLUSTER_SUMMARY = "Does the word limit include references?"
SEED = [
    ("Demo Student 01", "Does the 1500-word limit include references?"),
    ("Demo Student 02", "Is the reference list counted in the word count?"),
    ("Demo Student 03", "do refs count towards 1500 words"),
    ("Demo Student 04", "Are citations included in the word limit?"),
    ("Demo Student 05", "Is the bibliography part of the 1500?"),
    ("Demo Student 06", "Does the word count include in-text citations?"),
    ("Demo Student 07", "Will my references push me over 1500?"),
    ("Demo Student 08", "word limit — refs in or out?"),
    ("Demo Student 09", "Is the 1500 excluding the reference section?"),
    ("Demo Student 10", "Do quotes and references count as words?"),
    ("Demo Student 11", "Should I count my bibliography?"),
    ("Demo Student 12", "1500 words: with or without references?"),
    ("Demo Student 13", "Does the reference page count?"),
]

_REF = re.compile(
    r"\b(?:references?|refs|bibliography|works cited|reference list|reference section|reference page|citations?)\b",
    re.IGNORECASE,
)
_WORD_LIMIT = re.compile(r"\b(?:words?|word\s*count|word\s*limit|1500)\b", re.IGNORECASE)
_INCLUDE = re.compile(
    r"\b(?:includ\w*|towards|toward|part of|within|count(?:s|ed|ing)?)\b",
    re.IGNORECASE,
)
_SOURCE = re.compile(r"\b(?:sources?|papers?|articles?)\b", re.IGNORECASE)
_HOW_MANY = re.compile(
    r"\b(?:how many|number of|do i need|must i use|are required|is required|required)\b",
    re.IGNORECASE,
)
_ASKING = re.compile(r"\b(?:what|how|does|do|is|are|should|can|limit|many|long)\b", re.IGNORECASE)
_DEADLINE = re.compile(
    r"\b(?:deadline|due date|when is it due|when do i (?:have to )?submit|submission date|hand[\s-]?in date)\b",
    re.IGNORECASE,
)
_OUTCOMES = re.compile(r"\blearning outcomes?\b", re.IGNORECASE)
_MODULE = re.compile(
    r"\b(?:module code|which module|what module|what university|which university|cmp\s*2045)\b",
    re.IGNORECASE,
)
_WEIGHT = re.compile(
    r"\b(?:how much is (?:it|this|the assignment) worth|weighting|percentage of the module)\b",
    re.IGNORECASE,
)

_clusters: dict[str, dict] = {}


BRIEF = """University of Manchester
CMP2045 Research Methods in Psychology, University of Manchester.

Assignment brief

Task
Write a 1500-word critical evaluation of social media use and adolescent anxiety.

Sources
You must use five academic sources.

Learning outcomes
Evaluate claims about social media use and adolescent anxiety, judge whether a study design supports those claims, and use academic sources in a critical argument.

Deadline
Submit by 18 December 2026 at 14:00 UK time.

Assessment weighting
This assignment is worth 40% of the module mark.
"""


def brief_text() -> str:
    return BRIEF


def _intent(question: str) -> str:
    # References and the word limit are unresolved. Do this before the
    # answerable word-limit and source-count rules.
    if _REF.search(question) and (_WORD_LIMIT.search(question) or _INCLUDE.search(question)):
        return "word_limit_references"
    if _SOURCE.search(question) and _HOW_MANY.search(question) and not _REF.search(question):
        return "source_count"
    if (
        _WORD_LIMIT.search(question)
        and _ASKING.search(question)
        and not _REF.search(question)
    ):
        return "word_limit"
    if _DEADLINE.search(question):
        return "deadline"
    if _OUTCOMES.search(question):
        return "learning_outcomes"
    if _MODULE.search(question):
        return "module"
    if _WEIGHT.search(question):
        return "weighting"
    return "unknown"


def _normal(question: str) -> str:
    collapsed = re.sub(r"[^a-z0-9\s]", " ", question.lower())
    return re.sub(r"\s+", " ", collapsed).strip()


def _has_student(cluster: dict, student: str) -> bool:
    key = student.strip().casefold()
    return any(name.casefold() == key for name in cluster["students"])


def _public(cluster: dict) -> dict:
    return {
        "id": cluster["id"],
        "summary": cluster["summary"],
        "questions": list(cluster["questions"]),
        "students": list(cluster["students"]),
        "status": cluster["status"],
        "lecturer_answer": cluster["lecturer_answer"],
        "suggested_clarification": cluster["suggested_clarification"],
    }


def _ensure(cluster_id: str, summary: str, clarification: str) -> dict:
    cluster = _clusters.get(cluster_id)
    if cluster is None:
        cluster = {
            "id": cluster_id,
            "summary": summary,
            "questions": [],
            "students": [],
            "status": "open",
            "lecturer_answer": None,
            "suggested_clarification": clarification,
        }
        _clusters[cluster_id] = cluster
    return cluster


def _add(cluster: dict, student: str, question: str) -> None:
    name = student.strip()
    if name and not _has_student(cluster, name):
        cluster["students"].append(name)
    if question.strip():
        cluster["questions"].append(question.strip())


def _answered(quote: str) -> dict:
    note_agent("Guardian", "passed", "Brief answer quoted from the assignment brief")
    return {
        "status": "answered",
        "answer": quote,
        "citation": quote,
        "confidence": ANSWER_CONFIDENCE,
        "cluster_id": None,
        "cluster_size": 0,
    }


def _escalated(cluster: dict) -> dict:
    note_agent(
        "Guardian",
        "escalated",
        "Brief question escalated; the brief does not support an answer",
    )
    return {
        "status": "escalated",
        "answer": None,
        "citation": None,
        "confidence": ESCALATE_CONFIDENCE,
        "cluster_id": cluster["id"],
        "cluster_size": len(cluster["students"]),
    }


def reset_brief() -> None:
    """Restore the 13 seeded students. Does not write a guardian event."""
    _clusters.clear()
    cluster = _ensure(_REFERENCES, CLUSTER_SUMMARY, _GAP)
    cluster["questions"] = [question for _student, question in SEED]
    cluster["students"] = [student for student, _question in SEED]
    cluster["status"] = "open"
    cluster["lecturer_answer"] = None


def ask(student: str, question: str) -> dict:
    """Answer from the brief, or escalate. Never guess a missing policy."""
    if not isinstance(question, str):
        question = ""
    if not isinstance(student, str):
        student = ""
    cleaned = scan_input(question)["text"].strip()
    intent = _intent(cleaned) if cleaned else "unknown"
    quote = QUOTES.get(intent)
    if (
        quote
        and quote in brief_text()
        and not should_escalate(ANSWER_CONFIDENCE, "supported")
    ):
        return _answered(quote)

    if intent == "word_limit_references":
        cluster = _ensure(_REFERENCES, CLUSTER_SUMMARY, _GAP)
    elif cleaned:
        digest = hashlib.sha256(_normal(cleaned).encode()).hexdigest()[:10]
        cluster = _ensure(f"cl-{digest}", cleaned[:120], _GENERIC_GAP)
    else:
        cluster = _ensure("cl-unreadable", "The question could not be read.", _GENERIC_GAP)
    # Unsupported stays escalated even if a future threshold would not say so.
    should_escalate(ESCALATE_CONFIDENCE, "unsupported")
    _add(cluster, student, cleaned)
    return _escalated(cluster)


def queue() -> list[dict]:
    return [_public(cluster) for cluster in _clusters.values()]


def answer(cluster_id: str, text: str) -> dict | None:
    """Store the lecturer's own words and mark the cluster answered."""
    cluster = _clusters.get(cluster_id)
    if cluster is None:
        return None
    clarification = text.strip() if isinstance(text, str) else ""
    if not clarification:
        return _public(cluster)
    cluster["status"] = "answered"
    cluster["lecturer_answer"] = clarification
    note_agent("Guardian", "passed", "Lecturer clarification recorded for a brief cluster")
    return _public(cluster)


def broadcasts(student: str) -> list[dict]:
    if not isinstance(student, str):
        return []
    return [
        _public(cluster)
        for cluster in _clusters.values()
        if cluster["status"] == "answered" and _has_student(cluster, student)
    ]


reset_brief()
