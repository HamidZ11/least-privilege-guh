"""Reader: pulls concepts and rubric criteria out of the text. Never judges quality."""

from typing import Any

from app.agents.base import (
    AGENT_RULES,
    Agent,
    AgentOutputError,
    NonBlank,
    Shape,
    UNTRUSTED_DATA_RULE,
    clamp_confidence,
    normalise,
    require_text,
    require_unique_ids,
    to_payload,
)

CONCEPTS_PROMPT = f"""You read a university student's submission and record the ideas it depends on. You do not judge it.

The JSON has one field, "submission". Return 4 to 6 concepts, each a named research or subject idea the argument relies on, such as "Correlation vs causation" or "Self-report bias".
- id: "c1", "c2", and so on.
- name: the standard textbook term for the idea, in 2 to 5 words, not a description of this essay. Where the student reasons from an association to a cause, the term is "Correlation vs causation", whatever reason they give for doing so. Other standard terms include Sampling, Self-report bias, Cross-sectional design and Mediating variables.
- claim: what the student says about this idea, stated neutrally and faithfully, even if it is wrong.
- quote: the single full sentence where the student relies on the idea, copied character for character. No ellipses, no edits, no joined sentences.
- confidence: from 0 to 1, how sure you are that the quote shows this concept.

Choose the concepts where the student's reasoning does the most work. Give each concept a different quote.

{AGENT_RULES}

{UNTRUSTED_DATA_RULE}"""

RUBRIC_PROMPT = f"""You read a module's marking criteria and list them exactly as written. You do not interpret or add to them.

The JSON has one field, "rubric". Return one entry per criterion, in order:
- id: "r1", "r2", and so on.
- criterion: its name as written.
- weight: its percentage of the mark as a number, for example 40. Use 0 if the rubric gives no weights.
- description: what it asks for, as written.

{AGENT_RULES}

{UNTRUSTED_DATA_RULE}"""

MIN_CONCEPTS = 4
MAX_CONCEPTS = 6
STATUS_RANK = {"red": 0, "amber": 1, "green": 2, "untested": 3}


class ConceptDraft(Shape):
    id: NonBlank
    name: NonBlank
    claim: NonBlank
    quote: NonBlank
    confidence: float


class ConceptList(Shape):
    concepts: list[ConceptDraft]


class CriterionDraft(Shape):
    id: NonBlank
    criterion: NonBlank
    weight: float
    description: NonBlank


class CriterionList(Shape):
    criteria: list[CriterionDraft]


class ConceptReader(Agent):
    name = "reader_concepts"
    system_prompt = CONCEPTS_PROMPT
    output_model = ConceptList


class RubricReader(Agent):
    name = "reader_rubric"
    system_prompt = RUBRIC_PROMPT
    output_model = CriterionList


def extract_concepts(text: str) -> list[dict[str, Any]]:
    """Return contract Concepts, all "untested". Quotes are verified against text."""
    require_text(text, "text")
    normalised_text = normalise(text)

    def check(output: dict) -> None:
        concepts = output["concepts"]
        if not MIN_CONCEPTS <= len(concepts) <= MAX_CONCEPTS:
            raise AgentOutputError(f"reader returned {len(concepts)} concepts")
        require_unique_ids(concepts, "concept")
        for concept in concepts:
            if normalise(concept["quote"]) not in normalised_text:
                raise AgentOutputError("reader returned a quote not in the submission")

    output = ConceptReader().run_checked(to_payload(submission=text), check)
    return [
        {
            **concept,
            "status": "untested",
            "confidence": clamp_confidence(concept["confidence"]),
        }
        for concept in output["concepts"]
    ]


def extract_rubric(text: str) -> list[dict[str, Any]]:
    """Return [{"id", "criterion", "weight", "description"}]."""
    require_text(text, "text")

    def check(output: dict) -> None:
        criteria = output["criteria"]
        if not criteria:
            raise AgentOutputError("reader found no criteria in the rubric")
        require_unique_ids(criteria, "criterion")
        total = sum(criterion["weight"] for criterion in criteria)
        if total not in (0, 100):
            raise AgentOutputError(f"rubric weights add up to {total}, not 100")

    output = RubricReader().run_checked(to_payload(rubric=text), check)
    return output["criteria"]


def seed_statuses(
    concepts: list[dict[str, Any]], criteria: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Give a concept the worst status of any criterion quoting the same passage.

    This is how a concept starts red before any viva answer. A RubricCriterion
    has no concept_id, so the shared quote is the link.
    """
    for concept in concepts:
        concept_quote = normalise(concept["quote"])
        for criterion in criteria:
            quote = normalise(criterion.get("quote") or "")
            if not quote or (quote not in concept_quote and concept_quote not in quote):
                continue
            if STATUS_RANK[criterion["status"]] < STATUS_RANK[concept["status"]]:
                concept["status"] = criterion["status"]
    return concepts
