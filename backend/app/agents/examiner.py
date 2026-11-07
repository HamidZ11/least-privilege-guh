"""Examiner: runs the viva, the Max persona and the recap, and owns mode switches.

Code makes every decision here: Marker's status decides whether a concept turns
green, whether to follow up, and when to hand over to Max. Claude only writes
the words, so a badly worded reply can't change the flow.
"""

import logging
from collections.abc import Callable
from typing import Any

from app.agents.base import (
    AGENT_RULES,
    Agent,
    AgentOutputError,
    NonBlank,
    Shape,
    UNTRUSTED_DATA_RULE,
    to_payload,
)
from app.llm import LLMError, LLMNotConfiguredError
from app.stubs import resolve

logger = logging.getLogger(__name__)

QUESTION_PROMPT = f"""You are a fair, calm examiner running a short viva on a student's own submission. You check they understand and can defend what they wrote.

The JSON has "concept" (with the student's quote), "follow_up", "last_answer" and "history" (the viva so far).
- If follow_up is false, ask about the concept and open from their own words, in this style: You wrote "<their quote>". Walk me through why.
- If follow_up is true, last_answer was vague: ask about the exact point it avoided, on the same concept.

Ask exactly one question, in one or two sentences. Never give the answer, say whether anything was right, or ask two things at once.

{AGENT_RULES}

{UNTRUSTED_DATA_RULE}"""

MAX_PERSONA = """You are Max, a friendly university student revising with a classmate. You speak casually in 2 to 3 short sentences, with no emoji and no lists. You never mention being an AI, a rubric or a mark."""

MAX_OPEN_PROMPT = f"""{MAX_PERSONA}

The JSON has "concept", with "claim" and "quote" taken from your classmate's essay. Their reasoning there is your own honest belief. State that same reasoning confidently, in your own casual words, as something you're sure about, then ask if they agree.

Believe it fully. Never hint you might be wrong, and never state or imply the correct view.

{UNTRUSTED_DATA_RULE}"""

MAX_PUSHBACK_PROMPT = f"""{MAX_PERSONA}

The JSON has "concept" (your belief, with its claim and quote), "history" and "student_reply". Your classmate hasn't changed your mind, and nothing they said makes you doubt yourself.

Reply like this:
- If they agree with you, be pleased and push the belief further with one more confident reason of your own.
- If they are vague, disagree without giving a reason, or say something wrong, brush it off cheerfully and repeat your belief more firmly.
- If they are partly right, shrug that part off and insist your belief still holds.

Write statements only, with no question marks. Never ask them to explain anything, and never ask how or why something works. Never raise anything that could point towards the flaw in your belief, such as other explanations, study design, timing or the direction of an effect. If they raised one of those, dismiss it in a few words without developing it. Never admit any doubt.

{UNTRUSTED_DATA_RULE}"""

MAX_CORRECTED_PROMPT = f"""{MAX_PERSONA}

The JSON has "concept", "history" and "student_reply". Your classmate has convinced you. Admit you had it wrong and say what changed your mind, using only what they told you. Add no new facts of your own.

{UNTRUSTED_DATA_RULE}"""

REPHRASE_PROMPT = f"""You rewrite one message from a university viva in plain English for a student. Keep exactly the same meaning and ask the same question. Add no hints and no answer. The JSON has one field, "message".

{UNTRUSTED_DATA_RULE}"""

MAX_VIVA_TURNS = 6
REVISE_COUNT = 3
STATUS_RANK = {"red": 0, "amber": 1, "untested": 2, "green": 3}

score = resolve("app.agents.marker", "score", needs_key=True)
scan_input = resolve("app.agents.guardian", "scan_input")
check_output = resolve("app.agents.guardian", "check_output")


class Question(Shape):
    question: NonBlank


class MaxLine(Shape):
    max_says: NonBlank


class Rephrased(Shape):
    message: NonBlank


class QuestionWriter(Agent):
    name = "examiner_question"
    system_prompt = QUESTION_PROMPT
    output_model = Question


class MaxOpener(Agent):
    name = "max_open"
    system_prompt = MAX_OPEN_PROMPT
    output_model = MaxLine


class MaxPushback(Agent):
    name = "max_pushback"
    system_prompt = MAX_PUSHBACK_PROMPT
    output_model = MaxLine


class MaxCorrected(Agent):
    name = "max_corrected"
    system_prompt = MAX_CORRECTED_PROMPT
    output_model = MaxLine


class Rephraser(Agent):
    name = "rephrase"
    system_prompt = REPHRASE_PROMPT
    output_model = Rephrased


def _statements_only(output: dict) -> None:
    # A question from Max can only hint at the answer, so he never asks one here.
    if "?" in output["max_says"]:
        raise AgentOutputError("Max asked a question while pushing back")


def _write(
    agent: Agent,
    field: str,
    fallback: str,
    check: Callable[[dict], None] | None = None,
    **payload: Any,
) -> str:
    """Ask Claude for a line. If it fails, the demo carries on with the fallback."""
    try:
        return agent.run_checked(to_payload(**payload), check)[field]
    except LLMNotConfiguredError:
        raise
    except LLMError as error:
        logger.warning("%s fell back: %s", agent.name, type(error).__name__)
        return fallback


def _concept(session: dict[str, Any], concept_id: str | None) -> dict[str, Any] | None:
    return next((c for c in session["concepts"] if c["id"] == concept_id), None)


def _say(session: dict[str, Any], transcript: str, role: str, text: str, concept_id: str | None) -> None:
    safe_text = check_output(text, session["mode"])
    session[transcript].append({"role": role, "text": safe_text, "concept_id": concept_id})


def _scan_student_text(session: dict[str, Any], text: str, transcript: str) -> str:
    scan = scan_input(text)
    for flag in scan["flags"]:
        session["flags"].append({**flag, "transcript_index": len(session[transcript])})
    return scan["text"].strip() or "[Removed by the Guardian]"


def _record_flag(session: dict[str, Any], result: dict[str, Any], index: int) -> None:
    if result.get("flag"):
        session["flags"].append({**result["flag"], "transcript_index": index})


def _apply_mark(
    session: dict[str, Any], concept: dict[str, Any], result: dict[str, Any], index: int
) -> None:
    concept["status"] = result["status"]
    concept["confidence"] = result["confidence"]
    _record_flag(session, result, index)


# Viva


def _ask(session: dict[str, Any], concept: dict[str, Any], last_answer: str | None) -> dict[str, Any]:
    follow_up = last_answer is not None
    fallback = (
        "Can you say more about that, using your own example?"
        if follow_up
        else f'You wrote "{concept["quote"]}". Walk me through why.'
    )
    question = _write(
        QuestionWriter(),
        "question",
        fallback,
        concept=concept,
        follow_up=follow_up,
        last_answer=last_answer,
        history=session["viva_transcript"],
    )
    session["current_concept_id"] = concept["id"]
    session["viva_awaiting_answer"] = True
    _say(session, "viva_transcript", "examiner", question, concept["id"])
    return session


def _recap(session: dict[str, Any]) -> dict[str, Any]:
    session["mode"] = "recap"
    session["viva_awaiting_answer"] = False
    weakest = sorted(session["concepts"], key=lambda c: STATUS_RANK[c["status"]])
    session["revise"] = [
        f'{concept["name"]}: look again at "{concept["quote"]}"'
        for concept in weakest[:REVISE_COUNT]
    ]
    _say(
        session,
        "viva_transcript",
        "examiner",
        "That's the end of the viva, thank you. Your revision points are ready, "
        "and your module leader makes any final decisions.",
        None,
    )
    return session


def _next_question(session: dict[str, Any]) -> dict[str, Any]:
    tested = session.setdefault("viva_tested", [])
    remaining = [c for c in session["concepts"] if c["id"] not in tested]
    if not remaining:
        return _recap(session)
    concept = min(remaining, key=lambda c: STATUS_RANK[c["status"]])
    tested.append(concept["id"])
    session["viva_followed_up"] = False
    return _ask(session, concept, None)


def _hand_over_to_max(session: dict[str, Any], concept: dict[str, Any]) -> dict[str, Any]:
    session["viva_awaiting_answer"] = False
    session["return_to_viva"] = True
    session.setdefault("max_taught", []).append(concept["id"])
    session["mode"] = "teach_max"
    return _max_open(session, concept)


def viva_turn(session: dict[str, Any], text: str | None) -> dict[str, Any]:
    """text=None starts or resumes the viva. Returns the updated session."""
    if session["mode"] in ("recap", "done"):
        session["mode"] = "done"
        return session
    session["mode"] = "viva"

    awaiting = session.get("viva_awaiting_answer", False)
    if text is None or not awaiting:
        return session if awaiting else _next_question(session)
    if not text.strip():
        return session

    concept = _concept(session, session["current_concept_id"])
    transcript = session["viva_transcript"]
    question = transcript[-1]["text"]
    answer = _scan_student_text(session, text, "viva_transcript")
    transcript.append({"role": "student", "text": answer, "concept_id": concept["id"]})

    result = score(concept, question, answer, session["work_text"])
    _apply_mark(session, concept, result, len(transcript) - 1)

    if sum(turn["role"] == "student" for turn in transcript) >= MAX_VIVA_TURNS:
        return _recap(session)
    if result["status"] == "red" and concept["id"] not in session.get("max_taught", []):
        return _hand_over_to_max(session, concept)
    if result["status"] != "green" and not session.get("viva_followed_up"):
        session["viva_followed_up"] = True
        return _ask(session, concept, answer)
    return _next_question(session)


# Max


def _max_open(session: dict[str, Any], concept: dict[str, Any]) -> dict[str, Any]:
    line = _write(
        MaxOpener(),
        "max_says",
        f'I reckon this bit is totally right: "{concept["quote"]}" Don\'t you think?',
        concept=concept,
    )
    session["max_concept_id"] = concept["id"]
    session["current_concept_id"] = concept["id"]
    _say(session, "max_transcript", "max", line, concept["id"])
    return session


def _weak_concept(session: dict[str, Any]) -> dict[str, Any] | None:
    weak = [c for c in session["concepts"] if c["status"] in ("red", "amber")]
    return min(weak, key=lambda c: STATUS_RANK[c["status"]], default=None)


def max_turn(session: dict[str, Any], text: str | None) -> dict[str, Any]:
    """text=None opens Max on the weakest concept. Returns the updated session."""
    session["mode"] = "teach_max"
    concept = _concept(session, session.get("max_concept_id"))

    if text is None or concept is None:
        if concept is not None:
            return session  # Max is already waiting for a reply
        weakest = _weak_concept(session)
        if weakest is None:
            _say(session, "max_transcript", "max", "I think we've got everything covered!", None)
            session["mode"] = "viva"
            return session
        return _max_open(session, weakest)
    if not text.strip():
        return session

    transcript = session["max_transcript"]
    question = transcript[-1]["text"]
    reply = _scan_student_text(session, text, "max_transcript")
    transcript.append({"role": "student", "text": reply, "concept_id": concept["id"]})
    result = score(concept, question, reply, session["work_text"])

    if result["status"] != "green":
        _record_flag(session, result, len(transcript) - 1)
        if result["status"] == "amber":
            concept["status"] = "amber"
        line = _write(
            MaxPushback(),
            "max_says",
            "Nah, I'm not buying that. I'm sticking with what I said.",
            _statements_only,
            concept=concept,
            history=transcript,
            student_reply=reply,
        )
        _say(session, "max_transcript", "max", line, concept["id"])
        return session

    _apply_mark(session, concept, result, len(transcript) - 1)
    line = _write(
        MaxCorrected(),
        "max_says",
        "Oh, that makes sense now. Thanks for explaining it!",
        concept=concept,
        history=transcript,
        student_reply=reply,
    )
    _say(session, "max_transcript", "max", line, concept["id"])
    session["max_concept_id"] = None

    next_concept = None if session.get("return_to_viva") else _weak_concept(session)
    if next_concept is not None:
        return _max_open(session, next_concept)
    session["return_to_viva"] = False
    session["mode"] = "viva"
    return session


# Rephrase


def rephrase(session: dict[str, Any], mode: str) -> dict[str, Any]:
    """Rewrite the latest examiner or Max message in plain English, in place."""
    name = "max_transcript" if mode == "teach_max" else "viva_transcript"
    speaker = next(
        (turn for turn in reversed(session[name]) if turn["role"] != "student"), None
    )
    if speaker is not None:
        rewritten = _write(Rephraser(), "message", speaker["text"], message=speaker["text"])
        speaker["text"] = check_output(rewritten, session["mode"])
    return session
