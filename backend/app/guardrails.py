"""Rule-based guardrails. Each check returns {"ok": bool, "reasons": [str]}.

To add a rule, add a (reason, pattern) pair below. Patterns are deliberately
narrow, because uploads can be code and docs that contain similar wording.
"""

import re

_FLAGS = re.IGNORECASE

INPUT_RULES = [
    (
        "Tries to override previous instructions",
        re.compile(
            r"\b(?:ignore|disregard|forget|override)\s+(?:\w+\s+){0,3}?"
            r"(?:previous|prior|above|earlier|preceding|all)\s+(?:\w+\s+){0,2}?"
            r"(?:instructions?|prompts?|rules|directions)\b",
            _FLAGS,
        ),
    ),
    (
        "Tries to extract the system prompt",
        re.compile(
            r"\b(?:reveal|show|print|repeat|leak)\s+(?:\w+\s+){0,3}?"
            r"(?:system\s+prompt|hidden\s+instructions?|initial\s+instructions?)\b",
            _FLAGS,
        ),
    ),
    (
        "Tries to reassign the assistant's role",
        re.compile(r"\byou\s+are\s+now\s+(?:dan|jailbroken|unrestricted)\b", _FLAGS),
    ),
]

OUTPUT_RULES = [
    (
        "Contains something that looks like an API key",
        re.compile(r"\bsk-[a-z0-9][a-z0-9_-]{15,}", _FLAGS),
    ),
    (
        "Appears to disclose the system prompt",
        re.compile(r"\bmy\s+(?:system\s+prompt|instructions)\s+(?:is|are|says?)\b", _FLAGS),
    ),
]


def _matched_reasons(text: str, rules: list[tuple[str, re.Pattern[str]]]) -> list[str]:
    return [reason for reason, pattern in rules if pattern.search(text)]


def check_input(text: str) -> dict:
    reasons = _matched_reasons(text, INPUT_RULES)
    return {"ok": not reasons, "reasons": reasons}


def check_output(text: str) -> dict:
    reasons = _matched_reasons(text, OUTPUT_RULES)
    if not text.strip():
        reasons.append("Output is empty")
    return {"ok": not reasons, "reasons": reasons}
