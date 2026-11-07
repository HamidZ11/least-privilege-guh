"""API routes. Handlers are sync `def` so FastAPI runs the blocking Claude call
in a worker thread instead of stalling the event loop."""

from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.agents.base import EchoAgent
from app.guardrails import check_input, check_output
from app.llm import LLMError, LLMNotConfiguredError
from app.sessions import create_session, get_session, update_session

router = APIRouter(prefix="/api")

# Keeps a full upload inside the default model's 200K-token context window.
MAX_UPLOAD_BYTES = 500_000


class EchoRequest(BaseModel):
    session_id: str


def _too_large() -> HTTPException:
    return HTTPException(413, f"Upload is over the {MAX_UPLOAD_BYTES:,} byte limit")


def _read_text_file(file: UploadFile) -> str:
    raw = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise _too_large()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(415, "Only UTF-8 text files are supported") from None
    if "\x00" in text:
        raise HTTPException(415, "Only UTF-8 text files are supported")
    return text


def _require_session(session_id: str) -> dict[str, Any]:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    return session


def _store_echo(
    session_id: str, status: str, output: str | None, reasons: list[str]
) -> dict[str, Any]:
    result = {"status": status, "output": output, "reasons": reasons}
    update_session(session_id, {"echo": result})
    return result


@router.post("/upload")
def upload(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
) -> dict[str, Any]:
    """Accept a text file or raw text as multipart form data. File wins if both."""
    content = _read_text_file(file) if file is not None else text or ""
    if len(content.encode()) > MAX_UPLOAD_BYTES:
        raise _too_large()
    if not content.strip():
        raise HTTPException(400, "Provide a non-empty file or text")

    session = create_session()
    update_session(
        session["id"],
        {
            "text": content,
            "chars": len(content),
            "filename": file.filename if file is not None else None,
        },
    )
    return {"session_id": session["id"], "chars": len(content)}


@router.post("/agent/echo")
def run_echo(body: EchoRequest) -> dict[str, Any]:
    """Run check_input -> EchoAgent -> check_output and store the result.

    A guardrail block is a normal outcome: 200 with status blocked_input or
    blocked_output. Blocked output is withheld from the response and session.
    """
    session = _require_session(body.session_id)
    text = session.get("text")
    if not text:
        raise HTTPException(400, "Session has no uploaded text")

    input_check = check_input(text)
    if not input_check["ok"]:
        return _store_echo(body.session_id, "blocked_input", None, input_check["reasons"])

    try:
        output = EchoAgent().run(text)["output"]
    except LLMNotConfiguredError as error:
        raise HTTPException(503, str(error)) from None
    except LLMError as error:
        raise HTTPException(502, str(error)) from None

    output_check = check_output(output)
    if not output_check["ok"]:
        return _store_echo(body.session_id, "blocked_output", None, output_check["reasons"])

    return _store_echo(body.session_id, "ok", output, [])


@router.get("/session/{session_id}")
def read_session(session_id: str) -> dict[str, Any]:
    return _require_session(session_id)
