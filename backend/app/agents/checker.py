"""Checker: shades each rubric criterion and notes the gap. Never gives a mark.

The rules for causal conclusions and counting sources come from Ebube's draft.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Any

from app.agents.base import (
    AGENT_RULES,
    Agent,
    AgentOutputError,
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

SYSTEM_PROMPT = f"""You are the Checker for a learning-check tool at a UK university. You compare a student's work with the module's marking criteria. This is a learning check: never give a mark, grade or percentage.

The JSON has "criterion" (one marking criterion), "work" and "reader_quotes" (sentences from the work already picked out as important, which may be empty).

Return:
- status:
  - green: clearly met.
  - amber: partly met, meaning present but flawed, thin or inaccurate.
  - red: missing, short of a stated requirement, or the work does the opposite of what the criterion asks.
- gap_note: one or two plain-English sentences saying what is met and what is missing, addressed to the student as "your" and referring to their wording. Never rewrite their sentence or offer replacement text.
- quote: one full sentence copied character for character from the work, showing the clearest flaw this criterion is about. Use a sentence from reader_quotes whenever one shows that flaw, and copy it exactly. If the problem is something absent, such as missing sources or references, instead pick the sentence nearest to the gap, for example the one citing the only source, and avoid reader_quotes for this. Use null only if no sentence relates to the criterion at all.
- confidence: from 0 to 1, how sure you are of the status.

Apply these rules:
- If the criterion asks whether conclusions follow from the evidence, and the central conclusion is a causal claim such as "proves" or "causes" drawn from observational or cross-sectional data, it is red, even if the work also names strengths or limitations. Say what it does well in the gap_note.
- If the criterion states a minimum, such as a number of sources, count for yourself from the citations in the work. Below the minimum is red.
- If the criterion is about explaining methods and the work explains them but makes a mistaken judgement about one of them, it is amber.
- If the criterion is about presentation and the work is clearly structured and readable but its referencing is incomplete or missing, it is amber.

{AGENT_RULES}

{UNTRUSTED_DATA_RULE}"""


class CriterionCheck(Shape):
    status: Status
    gap_note: NonBlank
    quote: str | None
    confidence: float


class CheckerAgent(Agent):
    name = "checker"
    system_prompt = SYSTEM_PROMPT
    output_model = CriterionCheck
    model = settings.judge_model


def _check_one(
    criterion: dict[str, Any], work_text: str, quotes: list[str]
) -> dict[str, Any]:
    normalised_work = normalise(work_text)

    def check(result: dict) -> None:
        quote = result["quote"]
        if quote is not None and normalise(quote) not in normalised_work:
            raise AgentOutputError(f"{criterion['id']} quotes text that isn't in the work")

    payload = to_payload(criterion=criterion, work=work_text, reader_quotes=quotes)
    result = CheckerAgent().run_checked(payload, check)
    return {
        "id": criterion["id"],
        "criterion": criterion["criterion"],
        "weight": criterion["weight"],
        "status": result["status"],
        "gap_note": result["gap_note"],
        "quote": result["quote"],
        "confidence": clamp_confidence(result["confidence"]),
    }


def check_rubric(
    criteria: list[dict[str, Any]], work_text: str, quotes: list[str] | None = None
) -> list[dict[str, Any]]:
    """Return contract RubricCriterion dicts, in the same order as criteria.

    Each criterion is its own concurrent call, so the wait is the slowest one.
    quotes are the Reader's concept quotes, if already known. Raises ValueError
    for bad arguments and LLMError if Claude fails.
    """
    if not criteria:
        raise ValueError("criteria must not be empty")
    require_text(work_text, "work_text")
    with ThreadPoolExecutor(max_workers=len(criteria)) as pool:
        return list(pool.map(lambda c: _check_one(c, work_text, quotes or []), criteria))
