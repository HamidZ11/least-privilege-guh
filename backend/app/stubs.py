"""Contract-shaped stand-ins for functions other people are still building.

main.py uses the real function as soon as its module exists, and GET /health
lists whatever is still stubbed here. Nothing in this file is real analysis.
"""

import importlib
import logging
import re
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

using_stubs: list[str] = []


def _use_stub(label: str, name: str) -> Callable[..., Any]:
    if label not in using_stubs:
        using_stubs.append(label)
        logger.warning("Using a stub for %s", label)
    return globals()[name]


def resolve(module: str, name: str, needs_key: bool = False) -> Callable[..., Any]:
    """Return the real function if its module exists yet, else the stub here.

    needs_key also uses the stub when there's no API key, so people without one
    can still build against the API. GET /health shows when that is happening.
    """
    if needs_key and not settings.anthropic_api_key:
        return _use_stub(f"{module}.{name} (no API key)", name)
    try:
        return getattr(importlib.import_module(module), name)
    except ModuleNotFoundError as error:
        if error.name != module:
            raise  # the module exists but is broken, which must not be hidden
    except AttributeError:
        pass
    return _use_stub(f"{module}.{name}", name)


_INJECTION = re.compile(r"<!--.*?-->", re.DOTALL)

_CONCEPTS = [
    ("c1", "Correlation vs causation", "red", "causes"),
    ("c2", "Self-report bias", "amber", "self-report"),
    ("c3", "Cross-sectional design", "amber", "cross-sectional"),
    ("c4", "Sampling", "green", "sample"),
]

_RUBRIC = [
    ("Critical analysis", 40, "red", "Your conclusion goes further than your evidence.", "causes"),
    ("Understanding of methods", 30, "amber", "A limitation of the measure isn't discussed.", "self-report"),
    ("Use of sources", 20, "red", "Fewer sources are used than the brief requires.", None),
    ("Presentation", 10, "amber", "The structure is clear but the referencing is incomplete.", None),
]

_log: list[dict[str, Any]] = []
_clusters: list[dict[str, Any]] = [
    {
        "id": "cl1",
        "summary": "Does the 1500 words include references?",
        "questions": ["Does the word count include references?"] * 13,
        "students": [f"Student {number}" for number in range(1, 14)],
        "status": "open",
        "lecturer_answer": None,
        "suggested_clarification": "The 1500 words excludes the reference list.",
    }
]


def _sentence_with(text: str, keyword: str | None) -> str | None:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    if keyword is None:
        return None
    match = next((s for s in sentences if keyword.lower() in s.lower()), None)
    return match or sentences[0]


def _record(agent: str, action: str, detail: str) -> None:
    _log.append(
        {
            "ts": datetime.now(timezone.utc).isoformat(),
            "agent": agent,
            "action": action,
            "detail": detail,
        }
    )


# guardian.py (Nüman)
def scan_input(text: str) -> dict[str, Any]:
    """Return {"text": cleaned text, "flags": [Flag]}."""
    found = _INJECTION.findall(text)
    _record("Guardian", "injection_blocked" if found else "input_scanned", "Stub scan")
    flags = [
        {
            "type": "injection",
            "severity": "high",
            "detail": "A hidden instruction was found and removed before analysis.",
            "evidence_quote": line,
            "transcript_index": None,
        }
        for line in found
    ]
    return {"text": _INJECTION.sub("", text), "flags": flags}


def check_output(text: str, mode: str) -> str:
    _record("Guardian", "passed", f"Stub output check ({mode})")
    return text


def agents_status() -> dict[str, Any]:
    roles = {
        "Reader": "Extracts concepts, claims and exact quotes",
        "Checker": "Shades each rubric criterion",
        "Examiner": "Runs the viva, Max and the recap",
        "Marker": "Scores answers against the submission",
        "Guardian": "Scans inputs and outputs, writes this log",
    }
    agents = [
        {"name": name, "role": role, "calls": 0, "last_action": "Stub"}
        for name, role in roles.items()
    ]
    return {"agents": agents, "log": _log[-50:]}


# brief.py (Nüman)
BRIEF_TEXT = (
    "University of Manchester - CMP2045 Research Methods in Psychology\n"
    "Assignment 1 (40% of module mark)\n"
    "Write a 1500-word critical evaluation of a published study investigating "
    "the relationship between social media use and anxiety in adolescents.\n"
    "You must use at least five academic sources.\n"
)


def brief_text() -> str:
    return BRIEF_TEXT


def ask(student: str, question: str) -> dict[str, Any]:
    if "sources" in question.lower():
        return {
            "status": "answered",
            "answer": "You must use at least five academic sources.",
            "citation": "You must use at least five academic sources.",
            "confidence": 0.9,
            "cluster_id": None,
            "cluster_size": 0,
        }
    cluster = _clusters[0]
    cluster["questions"].append(question)
    cluster["students"].append(student)
    return {
        "status": "escalated",
        "answer": None,
        "citation": None,
        "confidence": 0.3,
        "cluster_id": cluster["id"],
        "cluster_size": len(cluster["students"]),
    }


def queue() -> list[dict[str, Any]]:
    return _clusters


def answer(cluster_id: str, text: str) -> dict[str, Any] | None:
    cluster = next((c for c in _clusters if c["id"] == cluster_id), None)
    if cluster:
        cluster.update(status="answered", lecturer_answer=text)
    return cluster


def broadcasts(student: str) -> list[dict[str, Any]]:
    return [
        c for c in _clusters if c["status"] == "answered" and student in c["students"]
    ]


# reader.py (Hamid)
def extract_concepts(text: str) -> list[dict[str, Any]]:
    return [
        {
            "id": concept_id,
            "name": name,
            "claim": f"Stub claim about {name.lower()}.",
            "quote": _sentence_with(text, keyword),
            "status": "untested",
            "confidence": 0.5,
        }
        for concept_id, name, _, keyword in _CONCEPTS
    ]


def extract_rubric(text: str) -> list[dict[str, Any]]:
    return [
        {"id": f"r{index}", "criterion": row[0], "weight": row[1]}
        for index, row in enumerate(_RUBRIC, start=1)
    ]


# checker.py (Hamid)
def check_rubric(
    criteria: list[dict[str, Any]], work_text: str, quotes: list[str] | None = None
) -> list[dict[str, Any]]:
    by_name = {row[0]: row for row in _RUBRIC}
    results = []
    for criterion in criteria:
        row = by_name.get(criterion["criterion"], _RUBRIC[0])
        results.append(
            {
                **criterion,
                "status": row[2],
                "gap_note": row[3],
                "quote": _sentence_with(work_text, row[4]),
                "confidence": 0.5,
            }
        )
    return results


# marker.py (Hamid)
def score(
    concept: dict[str, Any], question: str, answer: str, work_text: str
) -> dict[str, Any]:
    good = len(answer.split()) >= 8
    return {
        "status": "green" if good else "amber",
        "confidence": 0.5,
        "reason": "Stub score based on answer length.",
        "flag": None,
    }


# examiner.py (Hamid)
def _weakest(session: dict[str, Any]) -> dict[str, Any] | None:
    order = {"red": 0, "untested": 1, "amber": 2, "green": 3}
    pending = [c for c in session["concepts"] if c["status"] != "green"]
    return min(pending, key=lambda c: order[c["status"]], default=None)


def viva_turn(session: dict[str, Any], text: str | None) -> dict[str, Any]:
    transcript = session["viva_transcript"]
    concept = _weakest(session)
    session["mode"] = "viva"
    if text is not None:
        transcript.append({"role": "student", "text": text, "concept_id": session["current_concept_id"]})
    if concept is None or sum(t["role"] == "student" for t in transcript) >= 6:
        session["mode"] = "done"
        session["revise"] = ["Correlation vs causation", "Self-report bias", "Sampling"]
        return session
    session["current_concept_id"] = concept["id"]
    transcript.append(
        {
            "role": "examiner",
            "text": f'You wrote "{concept["quote"]}". Walk me through why.',
            "concept_id": concept["id"],
            "confidence": 0.5,
        }
    )
    return session


def max_turn(session: dict[str, Any], text: str | None) -> dict[str, Any]:
    transcript = session["max_transcript"]
    concept = _weakest(session)
    session["mode"] = "teach_max"
    if text is not None and concept is not None:
        transcript.append({"role": "student", "text": text, "concept_id": concept["id"]})
        concept["status"] = "green"
        transcript.append(
            {
                "role": "max",
                "text": "Oh, that makes sense now, thanks!",
                "concept_id": concept["id"],
            }
        )
        concept = _weakest(session)
    if concept is None:
        session["mode"] = "viva"
        return session
    session["current_concept_id"] = concept["id"]
    transcript.append(
        {
            "role": "max",
            "text": f"I'm sure about this one: {concept['name'].lower()} is no big deal, right?",
            "concept_id": concept["id"],
        }
    )
    return session


def rephrase(session: dict[str, Any], mode: str) -> dict[str, Any]:
    transcript = session["viva_transcript"]
    if transcript and transcript[-1]["role"] == "examiner":
        transcript[-1]["text"] = f"In plain English: {transcript[-1]['text']}"
    return session


# Heatmap (Ebube)
def heatmap() -> list[dict[str, Any]]:
    return [
        {"concept": "Correlation vs causation", "red": 12, "amber": 5, "green": 3},
        {"concept": "Sampling", "red": 2, "amber": 4, "green": 14},
        {"concept": "Self-report bias", "red": 6, "amber": 9, "green": 5},
        {"concept": "Cross-sectional design", "red": 7, "amber": 7, "green": 6},
        {"concept": "Mediating variables", "red": 5, "amber": 8, "green": 7},
    ]


# tts.py (Ebube)
def synthesize(text: str, voice: str) -> bytes:
    raise RuntimeError("TTS is not available yet")
