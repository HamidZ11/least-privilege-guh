"""App entry point and the Viva API (build prompt, section 7)."""

import importlib
import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app import stubs
from app.llm import LLMError, LLMNotConfiguredError
from app.routes import router as skeleton_router
from app.sessions import create_session, get_session, list_sessions

logger = logging.getLogger(__name__)

MODULE = "CMP2045"
MAX_UPLOAD_BYTES = 2_000_000
SESSION_FIELDS = (
    "id", "student", "module", "mode", "concepts", "rubric", "viva_transcript",
    "max_transcript", "flags", "current_concept_id", "viva_started_at", "revise",
)  # fmt: skip

using_stubs: list[str] = []


def _use(module: str, name: str) -> Callable[..., Any]:
    """Return the real function if its module exists yet, else the stub."""
    try:
        return getattr(importlib.import_module(module), name)
    except ModuleNotFoundError as error:
        if error.name != module:
            raise  # the module exists but is broken, which must not be hidden
    except AttributeError:
        pass
    using_stubs.append(f"{module}.{name}")
    return getattr(stubs, name)


scan_input = _use("app.agents.guardian", "scan_input")
agents_status = _use("app.agents.guardian", "agents_status")
brief_text = _use("app.brief", "brief_text")
ask_brief = _use("app.brief", "ask")
brief_queue = _use("app.brief", "queue")
answer_cluster = _use("app.brief", "answer")
brief_broadcasts = _use("app.brief", "broadcasts")
extract_concepts = _use("app.agents.reader", "extract_concepts")
extract_rubric = _use("app.agents.reader", "extract_rubric")
check_rubric = _use("app.agents.checker", "check_rubric")
viva_turn = _use("app.agents.examiner", "viva_turn")
max_turn = _use("app.agents.examiner", "max_turn")
rephrase_turn = _use("app.agents.examiner", "rephrase")
class_heatmap = _use("app.heatmap", "heatmap")
synthesize = _use("app.tts", "synthesize")

if using_stubs:
    logger.warning("Using stubs for: %s", ", ".join(using_stubs))

app = FastAPI(title="Viva API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(LLMError)
def handle_llm_error(request: Request, error: LLMError) -> JSONResponse:
    status = 503 if isinstance(error, LLMNotConfiguredError) else 502
    return JSONResponse({"detail": str(error)}, status_code=status)


class TurnRequest(BaseModel):
    text: str | None = None


class RephraseRequest(BaseModel):
    mode: str


class AskRequest(BaseModel):
    student: str
    question: str


class AnswerRequest(BaseModel):
    cluster_id: str
    text: str


class TtsRequest(BaseModel):
    text: str
    voice: str


def _public(session: dict[str, Any]) -> dict[str, Any]:
    """The contract's Session: internal fields such as work_text stay private."""
    return {field: session[field] for field in SESSION_FIELDS}


def _session_or_404(session_id: str) -> dict[str, Any]:
    session = get_session(session_id)
    if session is None or "student" not in session:
        raise HTTPException(404, "Session not found")
    return session


def _read_text(file: UploadFile | None, text: str | None, label: str) -> str:
    if file is not None:
        raw = file.file.read(MAX_UPLOAD_BYTES + 1)
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"The {label} is too large")
        content = raw.decode("utf-8-sig", errors="replace")
    else:
        content = text or ""
    if not content.strip():
        raise HTTPException(400, f"Upload your {label} or paste it as text")
    return content


api = APIRouter(prefix="/api")


@api.post("/submit")
def submit(
    student: str = Form(...),
    work_file: UploadFile | None = File(None),
    work_text: str | None = Form(None),
    rubric_file: UploadFile | None = File(None),
    rubric_text: str | None = Form(None),
) -> dict[str, Any]:
    scan = scan_input(_read_text(work_file, work_text, "work"))
    rubric = _read_text(rubric_file, rubric_text, "rubric")
    clean_text = scan["text"]

    session = create_session()
    session.update(
        student=student,
        module=MODULE,
        mode="viva",
        concepts=extract_concepts(clean_text),
        rubric=check_rubric(extract_rubric(rubric), clean_text),
        viva_transcript=[],
        max_transcript=[],
        flags=scan["flags"],
        current_concept_id=None,
        viva_started_at=None,
        revise=[],
        work_text=clean_text,
    )
    return _public(session)


@api.get("/session/{session_id}")
def read_session(session_id: str) -> dict[str, Any]:
    return _public(_session_or_404(session_id))


@api.post("/session/{session_id}/viva")
def viva(session_id: str, body: TurnRequest) -> dict[str, Any]:
    session = _session_or_404(session_id)
    if session["viva_started_at"] is None:
        session["viva_started_at"] = datetime.now(timezone.utc).isoformat()
    return _public(viva_turn(session, body.text))


@api.post("/session/{session_id}/max")
def teach_max(session_id: str, body: TurnRequest) -> dict[str, Any]:
    return _public(max_turn(_session_or_404(session_id), body.text))


@api.post("/session/{session_id}/rephrase")
def rephrase(session_id: str, body: RephraseRequest) -> dict[str, Any]:
    return _public(rephrase_turn(_session_or_404(session_id), body.mode))


@api.get("/brief")
def read_brief() -> dict[str, str]:
    return {"text": brief_text()}


@api.post("/brief/ask")
def ask(body: AskRequest) -> dict[str, Any]:
    return ask_brief(body.student, body.question)


@api.get("/brief/broadcasts")
def broadcasts(student: str) -> list[dict[str, Any]]:
    return brief_broadcasts(student)


@api.get("/lecturer/queue")
def lecturer_queue() -> list[dict[str, Any]]:
    return brief_queue()


@api.post("/lecturer/answer")
def lecturer_answer(body: AnswerRequest) -> dict[str, Any]:
    cluster = answer_cluster(body.cluster_id, body.text)
    if cluster is None:
        raise HTTPException(404, "Cluster not found")
    return cluster


@api.get("/lecturer/reports")
def lecturer_reports() -> list[dict[str, Any]]:
    return [_public(s) for s in list_sessions() if "student" in s]


@api.get("/lecturer/heatmap")
def lecturer_heatmap() -> list[dict[str, Any]]:
    return class_heatmap()


@api.get("/agents")
def agents() -> dict[str, Any]:
    return agents_status()


@api.post("/tts")
def tts(body: TtsRequest) -> Response:
    try:
        return Response(synthesize(body.text, body.voice), media_type="audio/mpeg")
    except Exception as error:
        logger.warning("TTS failed: %s", type(error).__name__)
        raise HTTPException(503, "Voice is unavailable, showing text only") from None


# Registered first so the contract's /api/session/{id} wins over the skeleton's.
app.include_router(api)
app.include_router(skeleton_router)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "stubs": using_stubs}
