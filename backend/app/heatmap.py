"""Class heatmap: concepts x red/amber/green counts.

Combines the demo cohort in data/mock_students.json (labelled demo data in the UI)
with real sessions from app/sessions.py. Sessions are read-only here.
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

    for student in mock["students"]:
        for concept, status in student["concepts"].items():
            if status in STATUSES:
                counts.setdefault(concept, dict.fromkeys(STATUSES, 0))[status] += 1

    for session in list_sessions():
        for concept in session.get("concepts") or []:
            status = concept.get("status")
            if status in STATUSES:  # "untested" isn't counted yet
                counts.setdefault(concept["name"], dict.fromkeys(STATUSES, 0))[status] += 1

    return [{"concept": name, **c} for name, c in counts.items()]
