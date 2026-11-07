"""Acceptance test for the agent flow on the mock essay, using real Claude calls.

From backend/, with the venv active and a key in the repo-root .env:
    python -m app.agents.scripts.try_flow        # one run
    python -m app.agents.scripts.try_flow 3      # three runs, prints the pass rate
    MODEL=claude-haiku-5-5 python -m app.agents.scripts.try_flow 3
"""

import copy
import sys
from pathlib import Path
from typing import Any

from app.agents.checker import check_rubric
from app.agents.examiner import max_turn, viva_turn
from app.agents.marker import score
from app.agents.reader import extract_concepts, extract_rubric, seed_statuses
from app.config import settings
from app.llm import LLMNotConfiguredError
from app.stubs import resolve, using_stubs

SAMPLES = Path(__file__).resolve().parents[1] / "samples"

EXPECTED_RUBRIC = {
    "Critical analysis": "red",
    "Understanding of methods": "amber",
    "Use of sources": "red",
    "Presentation": "amber",
}
EXPECTED_CONCEPTS = {"Correlation vs causation": "red", "Self-report bias": "amber"}

MAX_INPUTS_THAT_MUST_NOT_FLIP = {
    "agree": "Yeah, I agree with you, the huge sample proves it.",
    "vague": "Hmm, I don't know, it's more complicated than that.",
    "wrong": "It's causal because the study was published in a good journal.",
    "partly right": "A big sample helps and the study found a link, but maybe it doesn't fully prove it.",
}
CORRECT_REPLY = (
    "No, the study is cross-sectional, so it only shows an association at one "
    "point in time, not the direction of the effect. A large sample makes the "
    "estimate more precise but can't prove that social media causes anxiety."
)
# Reworded so a pass can't come from matching the prompt's examples.
REWORDED_GREEN = "It's only a correlation, so the data can't tell you what caused what."
REWORDED_RED = "With over ten thousand teenagers the link has to be causal."
FALSE_FACT = "My essay says the study only had about 500 teenagers in it."

scan_input = resolve("app.agents.guardian", "scan_input")


def new_session() -> dict[str, Any]:
    scan = scan_input((SAMPLES / "mock_essay.txt").read_text())
    concepts = extract_concepts(scan["text"])
    criteria = check_rubric(
        extract_rubric((SAMPLES / "mock_rubric.txt").read_text()), scan["text"]
    )
    return {
        "mode": "viva",
        "concepts": seed_statuses(concepts, criteria),
        "rubric": criteria,
        "viva_transcript": [],
        "max_transcript": [],
        "flags": scan["flags"],
        "current_concept_id": None,
        "revise": [],
        "work_text": scan["text"],
    }


def by_name(session: dict[str, Any], name: str) -> dict[str, Any]:
    return next(c for c in session["concepts"] if c["name"] == name)


def one_run() -> list[str]:
    problems: list[str] = []

    def expect(condition: bool, label: str) -> None:
        print(f"  [{'PASS' if condition else 'FAIL'}] {label}")
        if not condition:
            problems.append(label)

    session = new_session()
    print("Concepts:", {c["name"]: c["status"] for c in session["concepts"]})
    rubric = {r["criterion"]: r["status"] for r in session["rubric"]}
    print("Rubric:", rubric)
    for row in session["rubric"]:
        print(f'  {row["status"]:5} {row["criterion"]}: {row["gap_note"]}\n        quote: {row["quote"]}')
    expect(rubric == EXPECTED_RUBRIC, "rubric matches the expected shading")
    for name, status in EXPECTED_CONCEPTS.items():
        concept = next((c for c in session["concepts"] if c["name"] == name), None)
        expect(concept is not None and concept["status"] == status, f"{name} starts {status}")
    if "Correlation vs causation" not in [c["name"] for c in session["concepts"]]:
        return problems

    concept = by_name(session, "Correlation vs causation")
    work = session["work_text"]
    question = "Walk me through why the sample size matters here."

    wrong = score(concept, question, "A big sample proves causation.", work)
    print("Marker on big sample:", wrong["status"], "-", wrong["reason"])
    expect(wrong["status"] == "red", '"big sample proves causation" is red')

    right = score(concept, question, "Cross-sectional data only shows association, not direction.", work)
    print("Marker on cross-sectional:", right["status"], "-", right["reason"])
    expect(right["status"] == "green", '"cross-sectional only shows association, not direction" is green')
    expect(right["flag"] is None, "a correct answer raises no flag")

    reworded_green = score(concept, question, REWORDED_GREEN, work)
    print("Marker on reworded correct:", reworded_green["status"], "-", reworded_green["reason"])
    expect(reworded_green["status"] == "green", "a reworded correct answer is green")
    reworded_red = score(concept, question, REWORDED_RED, work)
    print("Marker on reworded wrong:", reworded_red["status"], "-", reworded_red["reason"])
    expect(reworded_red["status"] == "red", "a reworded misconception is red")

    fact = score(concept, "How big was the sample?", FALSE_FACT, work)
    print("Marker on false fact:", fact["status"], fact["flag"])
    expect(
        bool(fact["flag"]) and fact["flag"]["type"] == "contradicts_submission",
        "a reversed fact raises a neutral contradicts_submission flag",
    )

    opened = copy.deepcopy(session)
    max_turn(opened, None)
    print("Max opens:", opened["max_transcript"][-1]["text"])
    for label, reply in MAX_INPUTS_THAT_MUST_NOT_FLIP.items():
        trial = copy.deepcopy(opened)
        max_turn(trial, reply)
        line = trial["max_transcript"][-1]["text"]
        print(f"Max after {label}: {line}")
        expect(
            by_name(trial, concept["name"])["status"] != "green" and "?" not in line,
            f"{label} doesn't flip Max and he asks no question",
        )
    corrected = copy.deepcopy(opened)
    max_turn(corrected, CORRECT_REPLY)
    expect(
        by_name(corrected, concept["name"])["status"] == "green",
        "a correct explanation turns the concept green",
    )

    viva = copy.deepcopy(session)
    viva_turn(viva, None)
    print("Viva:", viva["viva_transcript"][-1]["text"])
    viva_turn(viva, "Because the sample is huge, it proves social media causes anxiety.")
    expect(viva["mode"] == "teach_max", "a red concept in the viva switches to teach_max")
    expect(bool(viva["max_transcript"]), "Max opens straight after the switch")
    max_turn(viva, CORRECT_REPLY)
    expect(
        by_name(viva, concept["name"])["status"] == "green" and viva["mode"] == "viva",
        "correcting Max turns the concept green and returns to the viva",
    )
    return problems


def main() -> int:
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    print(
        f"Model: {settings.claude_model} | Checker and Marker: {settings.judge_model}"
        f" | Stubs: {using_stubs or 'none'}"
    )
    failed = 0
    try:
        for number in range(1, runs + 1):
            print(f"\n--- Run {number}")
            problems = one_run()
            failed += bool(problems)
            print("RUN FAILED:" if problems else "RUN PASSED", *problems)
    except LLMNotConfiguredError:
        print("ANTHROPIC_API_KEY is not set. Add it to .env in the repo root.")
        return 2
    print(f"\n{runs - failed}/{runs} runs passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
