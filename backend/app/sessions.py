"""Session store. In-memory for the demo: data is lost on restart and is not
shared between worker processes."""

from typing import Any
from uuid import uuid4

_sessions: dict[str, dict[str, Any]] = {}


def create_session() -> dict[str, Any]:
    session_id = str(uuid4())
    _sessions[session_id] = {"id": session_id}
    return _sessions[session_id]


def get_session(session_id: str) -> dict[str, Any] | None:
    return _sessions.get(session_id)


def update_session(session_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """Merge data into the session. Returns None if the session doesn't exist."""
    session = _sessions.get(session_id)
    if session is not None:
        session.update(data)
    return session
