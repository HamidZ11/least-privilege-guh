"""Class heatmap: concepts x red/amber/green counts.

Combines the demo cohort in data/mock_students.json (labelled demo data in the UI)
with sessions from app/sessions.py, which include seeded demo sessions. Sessions are
read-only here. Nobody is counted twice: a session wins over a mock student with the
same name, and each session counts once.
"""

import json
from pathlib import Path
from typing import Any

from app.sessions import list_sessions

MOCK_PATH = Path(__file__).parent / "data" / "mock_students.json"
STATUSES = ("red", "amber", "green")


def _load_mock() -> dict[str, Any]:
    try:
        return json.loads(MOCK_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"concepts": [], "students": []}  # never crash the Class Insights page


def heatmap() -> list[dict[str, Any]]:
    mock = _load_mock()
    counts: dict[str, dict[str, int]] = {
        name: dict.fromkeys(STATUSES, 0) for name in mock["concepts"]
    }

    sessions = [x for x in list_sessions() if "student" in x]
    session_names = {x["student"].strip().lower() for x in sessions}

    for student in mock["students"]:
        if student["student"].strip().lower() in session_names:
            continue
        for concept, status in student["concepts"].items():
            if status in STATUSES:
                counts.setdefault(concept, dict.fromkeys(STATUSES, 0))[status] += 1

    seen: set[str] = set()
    for session in sessions:
        if session["id"] in seen:
            continue
        seen.add(session["id"])
        for concept in session.get("concepts") or []:
            status = concept.get("status")
            if status in STATUSES:  # "untested" isn't counted yet
                counts.setdefault(concept["name"], dict.fromkeys(STATUSES, 0))[status] += 1

    return [{"concept": name, **c} for name, c in counts.items()]
