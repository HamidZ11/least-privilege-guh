"""App entry point and the Viva API (build prompt, section 7)."""

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.agents.reader import NothingToCheckError, seed_statuses
from app.llm import LLMError, LLMNotConfiguredError
from app.parsing import ParseError, extract_text
from app.routes import router as skeleton_router
from app.sessions import create_session, get_session, list_sessions
from app.stubs import resolve, using_stubs

logger = logging.getLogger(__name__)

MODULE = "CMP2045"
MAX_UPLOAD_BYTES = 2_000_000
SESSION_FIELDS = (
    "id", "student", "module", "mode", "concepts", "rubric", "viva_transcript",
    "max_transcript", "flags", "current_concept_id", "viva_started_at", "revise",
)  # fmt: skip

scan_input = resolve("app.agents.guardian", "scan_input")
agents_status = resolve("app.agents.guardian", "agents_status")
brief_text = resolve("app.brief", "brief_text")
ask_brief = resolve("app.brief", "ask")
brief_queue = resolve("app.brief", "queue")
answer_cluster = resolve("app.brief", "answer")
brief_broadcasts = resolve("app.brief", "broadcasts")
extract_concepts = resolve("app.agents.reader", "extract_concepts", needs_key=True)
extract_rubric = resolve("app.agents.reader", "extract_rubric", needs_key=True)
check_rubric = resolve("app.agents.checker", "check_rubric", needs_key=True)
viva_turn = resolve("app.agents.examiner", "viva_turn", needs_key=True)
max_turn = resolve("app.agents.examiner", "max_turn", needs_key=True)
rephrase_turn = resolve("app.agents.examiner", "rephrase", needs_key=True)
class_heatmap = resolve("app.heatmap", "heatmap")
synthesize = resolve("app.tts", "synthesize")

app = FastAPI(title="Viva API")

from app.seed import seed_demo_sessions

if os.getenv("SEED_DEMO", "1") == "1":
    seed_demo_sessions()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(LLMError)
def handle_llm_error(request: Request, error: LLMError) -> JSONResponse:
    if isinstance(error, LLMNotConfiguredError):
        status = 503
    elif isinstance(error, NothingToCheckError):
        status = 422
    else:
        status = 502
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
        try:
            content = extract_text(file.filename, raw)
        except ParseError as error:
            raise HTTPException(422, str(error)) from None
    else:
        content = text or ""
    if not content.strip():
        raise HTTPException(400, f"Upload your {label} or paste it as text")
    return content


def _check_work(rubric: str, clean_text: str) -> list[dict[str, Any]]:
    return check_rubric(extract_rubric(rubric), clean_text)


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

    with ThreadPoolExecutor(max_workers=2) as pool:
        concepts_job = pool.submit(extract_concepts, clean_text)
        criteria_job = pool.submit(_check_work, rubric, clean_text)
        concepts, criteria = concepts_job.result(), criteria_job.result()
    concepts = seed_statuses(concepts, criteria)

    session = create_session()
    session.update(
        student=student,
        module=MODULE,
        mode="viva",
        concepts=concepts,
        rubric=criteria,
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
