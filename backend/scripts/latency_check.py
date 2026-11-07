"""Times the demo path against a running backend (default http://localhost:8000).
Run from backend/: .venv/bin/python scripts/latency_check.py [runs]
Anything over 6s is marked SLOW. Stub endpoints are listed from /health, not failed."""

import statistics
import sys
import time
from pathlib import Path

import httpx

BASE = "http://localhost:8000"
SAMPLES = Path(__file__).resolve().parents[1] / "app" / "agents" / "samples"
SLOW_SECONDS = 6.0
RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 3

MAX_CORRECTION = (
    "A large sample doesn't prove causation. It reduces sampling error, but the study "
    "is cross-sectional, so it only shows an association, not which came first."
)
VIVA_ANSWERS = [
    "Cross-sectional data only shows association, not direction, so I should not say it proves causation.",
    "Self-report can be biased by recall error and social desirability, so I should not call it reliable.",
]

timings: dict[str, list[float]] = {}
statuses: dict[str, set[int | str]] = {}


def call(client: httpx.Client, label: str, method: str, path: str, **kwargs) -> httpx.Response | None:
    start = time.perf_counter()
    try:
        response = client.request(method, path, **kwargs)
        code: int | str = response.status_code
    except httpx.HTTPError as error:
        response, code = None, type(error).__name__
    timings.setdefault(label, []).append(time.perf_counter() - start)
    statuses.setdefault(label, set()).add(code)
    return response


def one_run(client: httpx.Client) -> None:
    submit = call(client, "POST /api/submit", "POST", "/api/submit", data={
        "student": "Aisha Khan",
        "work_text": (SAMPLES / "mock_essay.txt").read_text(),
        "rubric_text": (SAMPLES / "mock_rubric.txt").read_text(),
    })
    if submit is None or submit.status_code != 200:
        return  # later steps need a session
    sid = submit.json()["id"]
    call(client, "GET  /api/session/{id}", "GET", f"/api/session/{sid}")
    for label, body in [("POST max (open)", None), ("POST max (correction)", MAX_CORRECTION)]:
        call(client, label, "POST", f"/api/session/{sid}/max", json={"text": body})
    for label, body in [("POST viva (start)", None), ("POST viva (answer 1)", VIVA_ANSWERS[0]),
                        ("POST viva (answer 2)", VIVA_ANSWERS[1])]:
        call(client, label, "POST", f"/api/session/{sid}/viva", json={"text": body})
    call(client, "GET  /api/lecturer/reports", "GET", "/api/lecturer/reports")
    call(client, "GET  /api/lecturer/heatmap", "GET", "/api/lecturer/heatmap")
    call(client, "GET  /api/agents", "GET", "/api/agents")
    call(client, "POST /api/tts", "POST", "/api/tts",
         json={"text": "Hi Aisha, this is a short viva about your essay. There are no trick questions.",
               "voice": "examiner"})


def main() -> None:
    with httpx.Client(base_url=BASE, timeout=180.0) as client:
        try:
            health = client.get("/health").json()
        except httpx.HTTPError:
            sys.exit(f"Can't reach {BASE}. Start the backend first.")
        for i in range(RUNS):
            print(f"run {i + 1}/{RUNS}...", flush=True)
            one_run(client)

    print(f"\n{'endpoint':28} {'median':>8} {'max':>8}  status")
    for label, values in timings.items():
        slow = "  SLOW" if max(values) > SLOW_SECONDS else ""
        codes = ",".join(str(c) for c in sorted(statuses[label], key=str))
        print(f"{label:28} {statistics.median(values):7.2f}s {max(values):7.2f}s  {codes}{slow}")
    print("\nstubs in use:", ", ".join(health.get("stubs", [])) or "none")


main()
