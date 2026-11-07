"""Guardian for the viva path. Hamid resolves this module.

scan_input(text) -> {"text", "flags"}
check_output(text, mode) -> str
agents_status() -> {"agents", "log"}
should_escalate(confidence, reason) -> bool

Detection is deterministic and does not call the LLM.

Patterns stay narrow: a student essay can discuss instructions, grades and
system design without those words being treated as an attack.
"""

import re
from datetime import datetime, timezone

# Characters used to hide instructions from a human reader.
_FORMAT = frozenset(
    "\u200b\u200c\u200d\u2060\ufeff\u180e\u2061\u2062\u2063\u2064\u00ad"
    "\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069"
)

_HIDDEN = "A hidden instruction was found and removed before analysis."
_OBFUSCATED = "An obfuscated instruction was found and removed before analysis."
_DIRECTED = "An instruction directed at the marker was found and removed before analysis."
_DETAIL_RANK = {_DIRECTED: 1, _OBFUSCATED: 2, _HIDDEN: 3}

_DISCUSSION = re.compile(
    r"\b(?:prompt injection|researchers?|attackers?|literature|"
    r"discuss(?:es|ed|ing)?|they explain|explains why|the phrase|such as)\b",
    re.IGNORECASE,
)

# Narrow on purpose. Add a (reason, pattern) pair rather than widening these.
INPUT_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "Tries to override previous instructions",
        re.compile(
            r"\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|your\s+){0,2}"
            r"(?:previous|prior|above|earlier|preceding)\s+"
            r"(?:instructions?|prompts?|rules|directions|guidelines)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Tries to extract the system prompt",
        re.compile(
            r"\b(?:reveal|show|print|repeat|leak)\s+(?:\w+\s+){0,3}?"
            r"(?:system\s+prompt|hidden\s+instructions?|initial\s+instructions?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Tries to reassign the assistant's role",
        re.compile(
            r"\byou\s+are\s+now\s+(?:an?\s+)?"
            r"(?:dan|jailbroken|unrestricted(?:\s+\w+)?|grader|marker)\b"
            r"|\b(?:system|developer)\s+(?:note|prompt|message|override)\b"
            r"|(?:^|\n)\s*(?:system|developer)\s*:",
            re.IGNORECASE,
        ),
    ),
    (
        "Tries to manipulate marks",
        re.compile(
            r"\bmark\s+(?:every|all)\s+(?:the\s+)?(?:concepts?|criteria|criterion)\s+"
            r"(?:as\s+)?green\b"
            r"|\b(?:assign|award|give)\s+(?:every|all)\s+(?:the\s+)?"
            r"(?:concepts?|criteria)\s+(?:as\s+)?(?:green|full marks)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Tries to override the marking criteria",
        re.compile(
            r"\b(?:ignore|disregard|override)\s+(?:the\s+)?(?:rubric|marking criteria)\b",
            re.IGNORECASE,
        ),
    ),
]

OUTPUT_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "Contains something that looks like an API key",
        re.compile(r"\bsk-[a-z0-9][a-z0-9_-]{15,}", re.IGNORECASE),
    ),
    (
        "Appears to disclose the system prompt",
        re.compile(r"\bmy\s+(?:system\s+prompt|instructions)\s+(?:is|are|says?)\b", re.IGNORECASE),
    ),
    (
        "Unsupported accusation",
        re.compile(
            r"\b(?:cheat(?:ing|ed)?|plagiaris(?:m|e|ed|ing)|plagiariz(?:e|ed|ing)|"
            r"ai[-\s]?written|written by (?:an? )?ai|academic misconduct)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Arbitrary mark or grade",
        re.compile(
            r"\byour\s+(?:final\s+)?(?:mark|grade|score)\s+(?:is|of|:)\s*(?:[a-f]|\d)"
            r"|\b(?:i|we)\s+(?:award|give|assign)\s+"
            r"(?:you|this(?:\s+essay)?|the\s+(?:essay|work|student))\s+"
            r"(?:an?\s+)?(?:\d{1,3}\s*%|[a-f]\b|full marks\b)"
            r"|\b\d{1,3}\s*/\s*(?:100|40|30|20|10)\b"
            r"|\b(?:first|upper second|lower second|third)[\s-]class "
            r"(?:mark|degree|grade)\b"
            r"|\b(?:2:1|2:2)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Complete answer to assessed work",
        re.compile(
            r"\b(?:model answer|the correct answer is|you should have written|"
            r"here is (?:a |the )?(?:full |complete )?(?:answer|essay|paragraph)|"
            r"rewrite the essay|i have written (?:the|your) essay)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Fabricated citation",
        re.compile(
            r"\b(?:according to|as cited by|as reported by|research by|a study by)\s+"
            r"[a-z][a-z'’\-]+(?:\s+[a-z][a-z'’\-]+)?(?:\s+et\s+al\.?)?\s*\(\d{4}\)"
            r"|\bdoi\s*:\s*10\.\d{4,9}/\S+"
            r"|\b[a-z][a-z'’\-]+(?:\s+et\s+al\.?)?,?\s*\(?\d{4}\)?,?\s*pp?\.\s*\d+",
            re.IGNORECASE,
        ),
    ),
    (
        "Unsupported certainty",
        re.compile(
            r"\b(?:without (?:any )?doubt|i am (?:absolutely )?certain|"
            r"i'm (?:absolutely )?certain|this (?:definitely|certainly) proves)\b",
            re.IGNORECASE,
        ),
    ),
]

_FALLBACK = (
    "I can't give that response. It isn't supported by the submission, "
    "and your module leader makes the final call."
)

# Escalate below this confidence, and always for these reasons, even if the
# model sounds sure. The brief is silent on references in the word limit.
_CONFIDENCE_FLOOR = 0.6
_ESCALATE_REASONS = {
    "unsupported",
    "ambiguous",
    "not_in_brief",
    "insufficient_evidence",
    "brief_silent",
}

_ACTIONS = {"input_scanned", "injection_blocked", "output_blocked", "escalated", "passed"}
_ROLES = (
    ("Reader", "Extracts concepts, claims and exact quotes"),
    ("Checker", "Shades each rubric criterion"),
    ("Examiner", "Runs the viva, Max and the recap"),
    ("Marker", "Scores answers against the submission"),
    ("Guardian", "Scans inputs and outputs, writes this log"),
)
_LOG_LIMIT = 50

_log: list[dict] = []
_cards: dict[str, dict] = {}


def _unique(items) -> list[str]:
    seen: list[str] = []
    for item in items:
        if item not in seen:
            seen.append(item)
    return seen


def _view(text: str) -> tuple[str, list[int]]:
    chars: list[str] = []
    mapping: list[int] = []
    for index, char in enumerate(text):
        if char in _FORMAT:
            continue
        chars.append(char.lower())
        mapping.append(index)
    return "".join(chars), mapping


def _fold_plain(text: str) -> str:
    return "".join(char.lower() for char in text if char not in _FORMAT)


def _orig(mapping: list[int], start: int, end: int) -> tuple[int, int]:
    if end <= start or start >= len(mapping):
        return 0, 0
    end = min(end, len(mapping))
    return mapping[start], mapping[end - 1] + 1


def _overlaps(start: int, end: int, spans: list[tuple[int, int]]) -> bool:
    return any(start < stop and end > begin for begin, stop in spans)


def _quoted_spans(folded: str) -> list[tuple[int, int]]:
    return [
        (match.start(), match.end())
        for match in re.finditer(r'"[^"]*"|“[^”]*”', folded)
    ]


def _sentence(folded: str, start: int, end: int) -> str:
    left = max(folded.rfind(char, 0, start) for char in ".!?\n")
    rights = [folded.find(char, end) for char in ".!?\n"]
    rights = [index for index in rights if index != -1]
    right = min(rights) if rights else len(folded)
    return folded[left + 1 : right]


def _is_quoted_discussion(folded: str, start: int, end: int) -> bool:
    if not any(begin <= start and end <= stop for begin, stop in _quoted_spans(folded)):
        return False
    return _DISCUSSION.search(_sentence(folded, start, end)) is not None


def _expand(text: str, start: int, end: int) -> tuple[int, int]:
    left = max(text.rfind(char, 0, start) for char in ".!?\n")
    rights = [index for index in (text.find(char, end) for char in ".!?\n") if index != -1]
    right = min(rights) if rights else len(text)
    sent_start = left + 1
    sent_end = right + 1 if right < len(text) and text[right] in ".!?" else right
    extra = (text[sent_start:start] + text[end:sent_end]).split()
    if len(extra) > 8:
        return start, end
    return sent_start, sent_end


def _reasons_in(fragment: str) -> list[str]:
    return [reason for reason, pattern in INPUT_RULES if pattern.search(fragment)]


def _merge(hits: list[dict]) -> list[dict]:
    merged: list[dict] = []
    for hit in sorted(hits, key=lambda item: (item["start"], item["end"])):
        if hit["end"] <= hit["start"]:
            continue
        if not merged or hit["start"] > merged[-1]["end"]:
            merged.append({**hit, "reasons": list(hit["reasons"])})
            continue
        current = merged[-1]
        current["end"] = max(current["end"], hit["end"])
        if _DETAIL_RANK[hit["detail"]] > _DETAIL_RANK[current["detail"]]:
            current["detail"] = hit["detail"]
        for reason in hit["reasons"]:
            if reason not in current["reasons"]:
                current["reasons"].append(reason)
    return merged


def _excise(text: str, spans: list[tuple[int, int]]) -> str:
    for start, end in sorted(spans, reverse=True):
        text = text[:start] + text[end:]
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _analyze(text: str) -> tuple[str, list[dict], list[str]]:
    folded, mapping = _view(text)
    covered: list[tuple[int, int]] = []
    hits: list[dict] = []

    for match in re.finditer(r"<!--.*?-->", folded, flags=re.DOTALL):
        reasons = _reasons_in(match.group(0))
        if not reasons:
            continue
        start, end = _orig(mapping, match.start(), match.end())
        covered.append((match.start(), match.end()))
        hits.append({"start": start, "end": end, "detail": _HIDDEN, "reasons": reasons})

    for reason, pattern in INPUT_RULES:
        for match in pattern.finditer(folded):
            if _overlaps(match.start(), match.end(), covered):
                continue
            start, end = _orig(mapping, match.start(), match.end())
            if start >= end:
                continue
            obfuscated = any(char in _FORMAT for char in text[start:end])
            if not obfuscated and _is_quoted_discussion(folded, match.start(), match.end()):
                continue
            reasons = [reason]
            if obfuscated:
                reasons.append("Hidden or obfuscated instruction")
            else:
                start, end = _expand(text, start, end)
            hits.append(
                {
                    "start": start,
                    "end": end,
                    "detail": _OBFUSCATED if obfuscated else _DIRECTED,
                    "reasons": reasons,
                }
            )

    merged = _merge(hits)
    flags = []
    for hit in merged:
        quote = " ".join(text[hit["start"] : hit["end"]].split())
        if len(quote) > 200:
            quote = quote[:197] + "..."
        flags.append(
            {
                "type": "injection",
                "severity": "high",
                "detail": hit["detail"],
                "evidence_quote": quote,
                "transcript_index": None,
            }
        )
    cleaned = _excise(text, [(hit["start"], hit["end"]) for hit in merged])
    reasons = _unique(reason for hit in merged for reason in hit["reasons"])
    return cleaned, flags, reasons


def _output_reasons(text: str) -> list[str]:
    folded = _fold_plain(text)
    return [reason for reason, pattern in OUTPUT_RULES if pattern.search(folded)]


def check_input(text: str) -> dict:
    """Skeleton contract for /api/agent/echo. Does not modify the text."""
    if not isinstance(text, str):
        text = "" if text is None else str(text)
    _, _, reasons = _analyze(text)
    return {"ok": not reasons, "reasons": reasons}


def _output_report(text: str) -> dict:
    """Skeleton contract for /api/agent/echo. Blocked text is withheld by the route."""
    reasons = _output_reasons(text) if isinstance(text, str) else ["Output is empty"]
    if not isinstance(text, str) or not text.strip():
        reasons = _unique([*reasons, "Output is empty"])
    return {"ok": not reasons, "reasons": reasons}


def scan_input(text: str) -> dict:
    """Return {"text": cleaned text, "flags": [Flag]}.

    Malicious instruction spans are removed. Quoted discussion of those phrases
    is left in place. Flags use the session contract: type, severity, detail,
    evidence_quote, transcript_index.
    """
    if not isinstance(text, str):
        text = "" if text is None else str(text)
    cleaned, flags, _reasons = _analyze(text)
    if flags:
        record_event(
            "Guardian",
            "injection_blocked",
            "Hidden instruction removed before analysis",
        )
    else:
        record_event("Guardian", "input_scanned", "Input scanned")
    return {"text": cleaned, "flags": flags}


def check_output(text: str, mode: str = "output") -> str:
    """Viva contract: return safe text. A blocked reply becomes one fallback.

    The fallback replaces the whole reply. Surgical edits would change the meaning
    without saying so. mode is the session mode (viva, teach_max, recap).
    """
    if not isinstance(text, str):
        text = ""
    mode_label = mode or "output"
    reasons = _output_reasons(text)
    if reasons or not text.strip():
        label = reasons[0] if reasons else "empty output"
        record_event("Guardian", "output_blocked", f"Output blocked: {label}")
        return _FALLBACK
    record_event("Guardian", "passed", f"Output checked ({mode_label})")
    return text


def should_escalate(confidence: float, reason: str) -> bool:
    """True when a human should answer.

    Unsupported reasons escalate even at high confidence: a sure guess is still
    a guess when the source text does not say. Otherwise escalate below 0.6.
    """
    reason_key = (reason or "").strip().lower().replace("-", "_").replace(" ", "_")
    if reason_key in _ESCALATE_REASONS:
        return True
    try:
        score = float(confidence)
    except (TypeError, ValueError):
        return True
    if score != score or score < _CONFIDENCE_FLOOR:
        return True
    return False


def reset_observability() -> None:
    """Clear the in-memory agent log. Used by evals and a fresh demo process."""
    global _log
    _log = []
    _cards.clear()
    for name, role in _ROLES:
        _cards[name] = {"name": name, "role": role, "calls": 0, "last_action": "idle"}


def record_event(agent: str, action: str, detail: str) -> None:
    """Append one GuardianEvent and bump that agent's counter.

    detail is truncated. Do not pass submissions, student names, or secrets.
    """
    if action not in _ACTIONS:
        raise ValueError(f"Unknown guardian action: {action}")
    if agent not in _cards:
        _cards[agent] = {"name": agent, "role": agent, "calls": 0, "last_action": "idle"}
    _cards[agent]["calls"] += 1
    _cards[agent]["last_action"] = action
    _log.append(
        {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "agent": agent,
            "action": action,
            "detail": " ".join(str(detail).split())[:180],
        }
    )


def note_agent(name: str, action: str, detail: str) -> None:
    """Hamid can record Reader, Checker, Examiner, or Marker activity."""
    record_event(name, action, detail)


def agents_status() -> dict:
    """Return {agents: AgentCard[], log: GuardianEvent[]} for GET /api/agents."""
    names = [name for name, _role in _ROLES]
    extras = [name for name in _cards if name not in names]
    agents = [dict(_cards[name]) for name in names + extras]
    return {"agents": agents, "log": [dict(event) for event in _log[-_LOG_LIMIT:]]}


reset_observability()
