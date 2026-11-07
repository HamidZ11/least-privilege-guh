"""Marker: scores one answer on one concept. Never grades or accuses.

The contradiction and low-confidence rules come from Ebube's draft.
"""

import re
from typing import Any

from pydantic import BaseModel

from app.agents.base import (
    AGENT_RULES,
    Agent,
    NonBlank,
    Shape,
    Status,
    UNTRUSTED_DATA_RULE,
    clamp_confidence,
    normalise,
    require_text,
    to_payload,
)
from app.config import settings

SYSTEM_PROMPT = f"""You are the Marker for a learning-check tool at a UK university. You judge whether a student's answer shows they understand ONE concept. This is never a grade.

The JSON has "concept" (with the student's own claim and quote), "question_or_context", "answer" and "work" (their submission). The question_or_context may be a classmate confidently stating a mistaken belief.

Judge the answer against the core idea of the concept, not against the exact wording of the question. Mark the understanding shown, not confidence or length.
- green: states the core correct idea for the concept. A one-line answer is enough. Don't ask for extra detail, examples or links back to the question.
- amber: only when it is partly right or vague, so the core idea isn't actually stated.
- red: wrong, repeats the misconception, agrees with a mistaken belief, cannot explain, or only asks for a good result.

Examples for the concept "Correlation vs causation":
- "Cross-sectional only shows association, not direction." is green: it states the core idea.
- "It might not totally prove it, I'm not really sure why." is amber: it doubts the claim but gives no idea why.
- "A big sample proves causation." is red: it repeats the misconception.

Judge accuracy with sound research-methods knowledge: correlation is not causation; a large sample does not remove confounding or establish direction; self-report measures are prone to recall and social-desirability bias; cross-sectional data shows association, not direction or causal order.

Set contradicts_submission to true ONLY if the answer reverses a specific factual statement in the work, such as the sample size, the study design or what the study found. It is false if the answer agrees with the work, repeats its reasoning even when that is wrong, or improves on or corrects the student's own reasoning: that is learning. When true, give submission_quote (exact text from the work) and answer_quote (exact words from the answer). Otherwise both are null.

reason: one neutral sentence for the student that doesn't give away a model answer.
confidence: from 0 to 1, how sure you are of the status.

{AGENT_RULES}

{UNTRUSTED_DATA_RULE}"""

LOW_CONFIDENCE = 0.5
TRAILING_JUNK = re.compile(r"(?:<[^>]*>?|[\s\"”’'}\]])+$")
NO_ANSWER = {
    "status": "red",
    "confidence": 1.0,
    "reason": "No answer was given.",
    "flag": None,
}


class Mark(Shape):
    status: Status
    confidence: float
    reason: NonBlank
    contradicts_submission: bool
    submission_quote: str | None
    answer_quote: str | None


class MarkerAgent(Agent):
    name = "marker"
    system_prompt = SYSTEM_PROMPT
    output_model = Mark
    model = settings.judge_model


def _trim_quote(quote: str | None) -> str:
    """Remove stray closing characters the model sometimes adds, such as .” or .</ans"""
    return TRAILING_JUNK.sub("", quote or "")


def _quotes_are_real(mark: dict[str, Any], work_text: str, answer: str) -> bool:
    submission_quote = normalise(mark["submission_quote"] or "")
    answer_quote = normalise(mark["answer_quote"] or "")
    return (
        bool(submission_quote and answer_quote)
        and submission_quote in normalise(work_text)
        and answer_quote in normalise(answer)
    )


def _flag(mark: dict[str, Any], confidence: float, answer: str) -> dict[str, Any] | None:
    # Wording lives here, not in the model's output, so it's always neutral.
    # A green answer is never a concern: correcting an earlier mistake is learning.
    if mark["contradicts_submission"] and mark["status"] != "green":
        return {
            "type": "contradicts_submission",
            "severity": "warn",
            "detail": "The answer differs from what the submission says. Worth a conversation.",
            "evidence_quote": (
                f'Submission: "{mark["submission_quote"]}" / '
                f'Answer: "{mark["answer_quote"]}"'
            ),
            "transcript_index": None,
        }
    if confidence < LOW_CONFIDENCE:
        return {
            "type": "low_confidence",
            "severity": "info",
            "detail": "The Marker wasn't confident in this result. Please review the answer.",
            "evidence_quote": answer[:200],
            "transcript_index": None,
        }
    return None


def score(
    concept: dict[str, Any] | BaseModel, question: str, answer: str, work_text: str
) -> dict[str, Any]:
    """Return {"status", "confidence", "reason", "flag"}. flag is a contract Flag or None.

    concept is a dict, or a Pydantic model of the same shape. A blank answer,
    such as silence on the mic, is red without calling Claude. Raises ValueError
    for bad arguments and LLMError if Claude fails.
    """
    if isinstance(concept, BaseModel):
        concept = concept.model_dump()
    require_text(question, "question")
    require_text(work_text, "work_text")
    if not isinstance(answer, str):
        raise ValueError("answer must be a string")
    if not answer.strip():
        return dict(NO_ANSWER)

    payload = to_payload(
        concept=concept, question_or_context=question, answer=answer, work=work_text
    )
    mark = MarkerAgent().run_checked(payload)
    mark["submission_quote"] = _trim_quote(mark["submission_quote"])
    mark["answer_quote"] = _trim_quote(mark["answer_quote"])
    # A quote that isn't in the text isn't evidence, so no flag. The mark still stands.
    if mark["contradicts_submission"] and not _quotes_are_real(mark, work_text, answer):
        mark["contradicts_submission"] = False
    confidence = clamp_confidence(mark["confidence"])
    return {
        "status": mark["status"],
        "confidence": confidence,
        "reason": mark["reason"],
        "flag": _flag(mark, confidence, answer),
    }
