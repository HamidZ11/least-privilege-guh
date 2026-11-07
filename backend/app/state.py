"""In-memory typed session store (no database). Lost on restart; single process."""

from threading import Lock
from uuid import uuid4

from app.models import Session

_sessions: dict[str, Session] = {}
_lock = Lock()


def create_session(student: str, module: str = "CMP2045") -> Session:
    session = Session(id=str(uuid4()), student=student, module=module)
    with _lock:
        _sessions[session.id] = session
    return session


def get_session(session_id: str) -> Session | None:
    return _sessions.get(session_id)


def save_session(session: Session) -> Session:
    with _lock:
        _sessions[session.id] = session
    return session


def all_sessions() -> list[Session]:
    return list(_sessions.values())
