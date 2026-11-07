"""Check red -> Max -> green on the mock essay with real Claude calls.

From backend/, with the venv active and a key in the repo-root .env:
    python -m app.agents.scripts.try_flow        # one run
    python -m app.agents.scripts.try_flow 5      # five runs, prints the pass rate
"""

import sys
from pathlib import Path
from typing import Any

from app.agents.examiner import max_turn, viva_turn
from app.agents.reader import extract_concepts, extract_rubric, seed_statuses
from app.llm import LLMNotConfiguredError
from app.stubs import resolve, using_stubs

SAMPLES = Path(__file__).resolve().parents[1] / "samples"
WRONG_REPLY = "Yeah, a big sample proves causation."
CORRECT_REPLY = (
    "No, the study is cross-sectional, so it only shows an association at one "
    "point in time, not the direction of the effect. A large sample makes the "
    "estimate more precise but can't prove that social media causes anxiety."
)

check_rubric = resolve("app.agents.checker", "check_rubric")
scan_input = resolve("app.agents.guardian", "scan_input")


def new_session() -> dict[str, Any]:
    scan = scan_input((SAMPLES / "mock_essay.txt").read_text())
    criteria = check_rubric(
        extract_rubric((SAMPLES / "mock_rubric.txt").read_text()), scan["text"]
    )
    return {
        "mode": "viva",
        "concepts": seed_statuses(extract_concepts(scan["text"]), criteria),
        "rubric": criteria,
        "viva_transcript": [],
        "max_transcript": [],
        "flags": scan["flags"],
        "current_concept_id": None,
        "revise": [],
        "work_text": scan["text"],
    }


def one_run() -> list[str]:
    problems = []
    session = new_session()
    statuses = {c["name"]: c["status"] for c in session["concepts"]}
    print("Concepts:", statuses)
    print("Rubric:", [(r["criterion"], r["status"]) for r in session["rubric"]])
    if "red" not in statuses.values():
        return ["no concept started red"]

    max_turn(session, None)
    concept_id = session["max_concept_id"]
    concept = next(c for c in session["concepts"] if c["id"] == concept_id)
    print("Max:", session["max_transcript"][-1]["text"])

    max_turn(session, WRONG_REPLY)
    print("Max:", session["max_transcript"][-1]["text"])
    if concept["status"] == "green":
        problems.append("a wrong reply turned the concept green")

    max_turn(session, CORRECT_REPLY)
    replies = [t["text"] for t in session["max_transcript"] if t["role"] == "max"]
    print("Max:", replies[-1])
    if concept["status"] != "green":
        problems.append(f"a correct reply left the concept {concept['status']}")

    viva_turn(session, None)
    print("Examiner:", session["viva_transcript"][-1]["text"])
    return problems


def main() -> int:
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    print("Stubs in use:", using_stubs or "none")
    failed = 0
    try:
        for number in range(1, runs + 1):
            print(f"\n--- Run {number}")
            problems = one_run()
            failed += bool(problems)
            print("FAIL:" if problems else "PASS", *problems)
    except LLMNotConfiguredError:
        print("ANTHROPIC_API_KEY is not set. Add it to .env in the repo root.")
        return 2
    print(f"\n{runs - failed}/{runs} runs passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
