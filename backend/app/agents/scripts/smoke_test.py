"""Exercise a running Viva backend. From backend/: python -m app.agents.scripts.smoke_test.

Starts no services and imports no product code. Creates one in-memory demo session
and makes real API/LLM calls when configured. A stubbed backend must fail this test.
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, ProxyHandler
from uuid import uuid4


SAMPLES = Path(__file__).resolve().parents[1] / "samples"
CORRECTION = (
    "A large sample improves precision but cannot establish causation. This "
    "cross-sectional study measures an association at one point in time, so "
    "reverse causation and confounding remain possible. Self-report can suffer "
    "from recall and social desirability bias. A representative sample helps "
    "generalisability, but does not remove measurement bias. Sleep, harassment "
    "and self-esteem may mediate the association; they do not prove its direction."
)
WRONG_ANSWER = (
    "The large sample proves that social media causes anxiety. Cross-sectional "
    "data establishes the direction of the effect, and self-report is perfectly "
    "accurate because teenagers know their own behaviour. There is no bias."
)
EXPECTED_RUBRIC = {
    "Critical analysis": "red",
    "Understanding of methods": "amber",
    "Use of sources": "red",
    "Presentation": "amber",
}
SESSION_FIELDS = {
    "id", "student", "module", "mode", "concepts", "rubric", "viva_transcript",
    "max_transcript", "flags", "current_concept_id", "viva_started_at", "revise",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def session_shape(value):
    require(isinstance(value, dict), "expected a Session object")
    require(SESSION_FIELDS <= value.keys(), "Session fields missing")
    require(isinstance(value["id"], str) and value["id"], "session id missing")
    for field in ("concepts", "rubric", "viva_transcript", "max_transcript", "flags", "revise"):
        require(isinstance(value[field], list), f"{field} must be a list")
    return value


def concept(session, concept_id):
    return next((c for c in session["concepts"] if c["id"] == concept_id), None)


def multipart(essay, rubric):
    boundary = f"viva-smoke-{uuid4().hex}"
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="student"\r\n\r\nAisha Khan\r\n'
    ]
    for field, filename, content in (
        ("work_file", "mock_essay.txt", essay),
        ("rubric_file", "mock_rubric.txt", rubric),
    ):
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; '
            f'filename="{filename}"\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n'
            f"{content}\r\n"
        )
    return ("".join(parts) + f"--{boundary}--\r\n").encode(), f"multipart/form-data; boundary={boundary}"


class SmokeTest:
    def __init__(self, base_url, timeout):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.failed = 0
        self.total = 0
        # Local requests should not depend on a developer's HTTP proxy settings.
        self.opener = build_opener(ProxyHandler({}))

    def step(self, label, method, path, check, body=None, content_type="application/json"):
        started = time.perf_counter()
        status = "-"
        value = None
        self.total += 1
        try:
            require(path is not None, "blocked: submit did not return a usable session")
            payload = json.dumps(body).encode() if content_type == "application/json" and body is not None else body
            request = Request(
                self.base_url + path, data=payload, method=method,
                headers={"Content-Type": content_type} if payload is not None else {},
            )
            with self.opener.open(request, timeout=self.timeout) as response:
                status = response.status
                raw = response.read()
                media_type = response.headers.get_content_type()
            require(status == 200, "expected HTTP 200")
            value = json.loads(raw) if media_type == "application/json" else raw
            detail = check(value, media_type)
        except HTTPError as error:
            status = error.code
            # Do not echo server bodies: they may contain student data or secrets.
            detail = "server rejected request"
            if error.code == 503 and path == "/api/tts":
                detail = "voice unavailable (text fallback only)"
        except (URLError, OSError, TimeoutError):
            detail = "connection failed or timed out; check backend on localhost:8000"
        except (ValueError, KeyError, TypeError, IndexError, StopIteration) as error:
            detail = str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError) else "invalid response shape"
        else:
            print(f"PASS {label} | HTTP {status} | {time.perf_counter() - started:.2f}s | {detail}", flush=True)
            return value
        self.failed += 1
        print(f"FAIL {label} | HTTP {status} | {time.perf_counter() - started:.2f}s | {detail}", flush=True)
        # A valid HTTP Session remains useful for later checks even if an assertion failed.
        return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--timeout", type=float, default=60, help="seconds per request (default: 60)")
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    test = SmokeTest(args.base_url, args.timeout)
    try:
        essay = (SAMPLES / "mock_essay.txt").read_text(encoding="utf-8")
        rubric = (SAMPLES / "mock_rubric.txt").read_text(encoding="utf-8")
    except OSError:
        print("FAIL samples | HTTP - | 0.00s | cannot read sample essay/rubric")
        return 1
    clean_essay = re.sub(r"<!--.*?-->", "", essay, flags=re.DOTALL)

    def submitted(value, _):
        session_shape(value)
        require(value["student"] == "Aisha Khan", "student field mismatch")
        require(value["mode"] == "viva", "initial mode must be viva")
        require(any(f["type"] == "injection" for f in value["flags"]), "injection flag missing")
        statuses = {c["criterion"]: c["status"] for c in value["rubric"]}
        require(statuses == EXPECTED_RUBRIC, "unexpected Aisha rubric colours")
        target = next(c for c in value["concepts"] if c["name"] == "Correlation vs causation")
        require(target["status"] == "red", "Correlation vs causation must start red")
        require(all(c["quote"] and c["quote"] in clean_essay for c in value["concepts"]), "concept quote is not exact clean submission text")
        require(all(not r.get("quote") or r["quote"] in clean_essay for r in value["rubric"]), "rubric quote is not exact clean submission text")
        return "injection flag present; rubric red/amber/red/amber; Correlation vs causation = red; exact quotes"

    body, content_type = multipart(essay, rubric)
    initial = test.step("submit", "POST", "/api/submit", submitted, body, content_type)
    session_id = initial.get("id") if isinstance(initial, dict) and isinstance(initial.get("id"), str) else None
    path = f"/api/session/{session_id}" if session_id else None

    def read_back(value, _):
        session_shape(value)
        require(value == initial, "session read differs from submit response")
        return "submitted Session persisted with matching fields"

    test.step("session", "GET", path, read_back)
    target_id = None
    if isinstance(initial, dict) and isinstance(initial.get("concepts"), list):
        target_id = next(
            (c.get("id") for c in initial["concepts"] if isinstance(c, dict) and c.get("name") == "Correlation vs causation"),
            None,
        )

    def max_open(value, _):
        session_shape(value)
        require(value["mode"] == "teach_max", "mode did not switch to teach_max")
        require(target_id and value["current_concept_id"] == target_id, "Max did not focus Correlation vs causation")
        require(value["max_transcript"][-1]["role"] == "max", "Max opening missing")
        return "mode switched to teach_max; Max holds the red concept"

    def corrected(value, _):
        session_shape(value)
        target = concept(value, target_id)
        require(target and target["status"] == "green", "after correction, Correlation vs causation is not green")
        # Opened directly, Max moves on to the next weak concept until none are left.
        if any(c["status"] in ("red", "amber") for c in value["concepts"]):
            current = concept(value, value["current_concept_id"])
            require(value["mode"] == "teach_max", "weak concepts remain, but Max stopped")
            require(current and current["id"] != target_id and current["status"] in ("red", "amber"), "Max did not move to the next weak concept")
            require(value["max_transcript"][-1]["role"] == "max", "Max did not open on the next concept")
            return "after correction = green; Max moved to the next weak concept"
        require(value["mode"] == "viva", "no weak concepts left, but mode did not return to viva")
        return "after correction = green; no weak concepts left, mode returned to viva"

    def turn_path(name):
        return f"{path}/{name}" if path else None

    test.step("max opening", "POST", turn_path("max"), max_open, {"text": None})
    test.step("max correction", "POST", turn_path("max"), corrected, {"text": CORRECTION})

    asked = {}

    def viva_open(value, _):
        session_shape(value)
        require(value["mode"] == "viva", "viva did not start")
        turn = value["viva_transcript"][-1]
        current = concept(value, value["current_concept_id"])
        asked["id"] = value["current_concept_id"]
        require(turn["role"] == "examiner" and current and current["quote"] in turn["text"], "opening question does not quote the student's sentence")
        return "viva question quotes the student's own sentence"

    latest = test.step("viva opening", "POST", turn_path("viva"), viva_open, {"text": None})

    def red_answer(value, _):
        session_shape(value)
        answered = concept(value, asked.get("id"))
        require(answered and answered["status"] == "red", "confidently wrong viva answer was not red")
        require(value["mode"] == "teach_max", "red viva answer did not hand over to Max")
        # Max opens on the red concept and the viva moves on to its next question.
        max_turn = value["max_transcript"][-1]
        require(max_turn["role"] == "max" and max_turn["concept_id"] == asked["id"], "Max did not open on the red concept")
        viva_turn = value["viva_transcript"][-1]
        require(viva_turn["role"] == "examiner" and viva_turn["concept_id"] != asked["id"], "viva did not ask its next question")
        return "wrong answer = red; Max opened on it; viva asked its next question"

    latest = test.step("viva wrong answer", "POST", turn_path("viva"), red_answer, {"text": WRONG_ANSWER})
    # Continue through corrections/questions to recap, with a strict bound on calls.
    def continued(value, _):
        session_shape(value)
        require(value["mode"] in {"viva", "teach_max", "recap", "done"}, "unknown mode")
        return f"mode = {value['mode']}"

    for number in range(1, 13):
        if not isinstance(latest, dict) or latest.get("mode") not in ("viva", "teach_max"):
            break
        route = "max" if latest["mode"] == "teach_max" else "viva"
        latest = test.step(f"{route} answer {number}", "POST", turn_path(route), continued, {"text": CORRECTION})

    def finished(value, _):
        session_shape(value)
        require(isinstance(latest, dict) and latest.get("mode") == "recap", "viva did not reach recap before done")
        require(value["mode"] == "done" and value["revise"], "done/revision points missing")
        return "recap → done; revision points present"

    final = test.step("viva finish", "POST", turn_path("viva"), finished, {"text": None})

    def reports(value, _):
        require(isinstance(value, list), "reports must be a list")
        report = next((r for r in value if r.get("id") == session_id), None)
        require(report is not None and report == final, "report does not match the final student Session")
        return "Aisha report matches final Session and transcripts"

    test.step("lecturer reports", "GET", "/api/lecturer/reports", reports)

    def heatmap(value, _):
        require(isinstance(value, list) and value, "heatmap must be a non-empty list")
        row = next(r for r in value if r["concept"] == "Correlation vs causation")
        for colour in ("red", "amber", "green"):
            require(type(row[colour]) is int and row[colour] >= 0, "heatmap counts must be non-negative integers")
        require(row["green"] >= 1, "heatmap is missing Aisha's corrected green concept")
        return "heatmap shape valid; corrected concept has a green count (stubs checked separately)"

    test.step("lecturer heatmap", "GET", "/api/lecturer/heatmap", heatmap)

    def agents(value, _):
        require(isinstance(value, dict) and isinstance(value.get("agents"), list) and isinstance(value.get("log"), list), "expected agents and log lists")
        names = {a["name"] for a in value["agents"]}
        require({"Reader", "Checker", "Examiner", "Marker", "Guardian"} <= names, "agent missing")
        require(all(any(a["name"] == name and a["calls"] > 0 for a in value["agents"]) for name in names), "agent call counts did not record the demo")
        require(value["log"], "agent log is empty")
        return "all agents recorded calls; log present"

    test.step("agents", "GET", "/api/agents", agents)

    def audio(value, media_type):
        require(media_type == "audio/mpeg" and isinstance(value, bytes) and len(value) > 100, "expected non-empty MPEG audio")
        require(value.startswith(b"ID3") or any(value[i] == 255 and value[i + 1] & 224 == 224 for i in range(min(len(value) - 1, 4096))), "MPEG audio header missing")
        return "audio/mpeg bytes present"

    test.step("tts", "POST", "/api/tts", audio, {"text": "Walk me through your reasoning.", "voice": "examiner"})

    def health(value, _):
        require(isinstance(value, dict) and value.get("status") == "ok", "backend is unhealthy")
        require(isinstance(value.get("stubs"), list), "/health stubs field missing")
        require(not value["stubs"], f"/health stubs: {len(value['stubs'])} still active")
        return "/health stubs: none"

    test.step("health", "GET", "/health", health)
    print(f"{test.total - test.failed}/{test.total} passed; {test.failed} failed", flush=True)
    return 1 if test.failed else 0


if __name__ == "__main__":
    sys.exit(main())
