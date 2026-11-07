"""Checker: shades each rubric criterion and notes the gap. Never gives a mark.

The rules for causal conclusions and counting sources come from Ebube's draft.
"""

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

The JSON has "criteria", "work" and "reader_quotes" (sentences from the work already picked out as important).

Return one result per criterion, using its id:
- status:
  - green: clearly met.
  - amber: partly met, meaning present but flawed, thin or inaccurate.
  - red: missing, short of a stated requirement, or the work does the opposite of what the criterion asks.
- gap_note: one or two plain-English sentences saying what is met and what is missing, addressed to the student as "your" and referring to their wording. Never rewrite their sentence or offer replacement text.
- quote: one full sentence copied character for character from the work, showing the clearest flaw this criterion is about. Use a sentence from reader_quotes whenever one shows that flaw, and copy it exactly. If the problem is something absent, such as missing sources or references, instead pick the sentence nearest to the gap, for example the one citing the only source, and avoid reader_quotes for this. Use null only if no sentence relates to the criterion at all.
- confidence: from 0 to 1, how sure you are of the status.

Apply these rules:
- If a criterion asks whether conclusions follow from the evidence, and the central conclusion is a causal claim such as "proves" or "causes" drawn from observational or cross-sectional data, it is red, even if the work also names strengths or limitations. Say what it does well in the gap_note.
- If a criterion states a minimum, such as a number of sources, count for yourself from the citations in the work. Below the minimum is red.
- If a criterion is about explaining methods and the work explains them but makes a mistaken judgement about one of them, it is amber.
- If a criterion is about presentation and the work is clearly structured and readable but its referencing is incomplete or missing, it is amber.

{AGENT_RULES}

{UNTRUSTED_DATA_RULE}"""


class CriterionCheck(Shape):
    id: NonBlank
    status: Status
    gap_note: NonBlank
    quote: str | None
    confidence: float


class CheckReport(Shape):
    results: list[CriterionCheck]


class CheckerAgent(Agent):
    name = "checker"
    system_prompt = SYSTEM_PROMPT
    output_model = CheckReport
    model = settings.judge_model


def check_rubric(
    criteria: list[dict[str, Any]], work_text: str, quotes: list[str] | None = None
) -> list[dict[str, Any]]:
    """Return contract RubricCriterion dicts, in the same order as criteria.

    quotes are the Reader's concept quotes. Passing them lets a criterion share
    a quote with a concept, which is how seed_statuses links the two. Raises
    ValueError for bad arguments and LLMError if Claude fails.
    """
    if not criteria:
        raise ValueError("criteria must not be empty")
    require_text(work_text, "work_text")
    normalised_work = normalise(work_text)
    expected_ids = {criterion["id"] for criterion in criteria}

    def check(report: dict) -> None:
        results = report["results"]
        if sorted(result["id"] for result in results) != sorted(expected_ids):
            raise AgentOutputError("checker did not return each criterion exactly once")
        for result in results:
            quote = result["quote"]
            if quote is not None and normalise(quote) not in normalised_work:
                raise AgentOutputError(f"{result['id']} quotes text that isn't in the work")

    report = CheckerAgent().run_checked(
        to_payload(criteria=criteria, work=work_text, reader_quotes=quotes or []), check
    )
    by_id = {result["id"]: result for result in report["results"]}
    return [
        {
            "id": criterion["id"],
            "criterion": criterion["criterion"],
            "weight": criterion["weight"],
            "status": by_id[criterion["id"]]["status"],
            "gap_note": by_id[criterion["id"]]["gap_note"],
            "quote": by_id[criterion["id"]]["quote"],
            "confidence": clamp_confidence(by_id[criterion["id"]]["confidence"]),
        }
        for criterion in criteria
    ]
