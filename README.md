# Least Privilege @ GreatUniHack 2026

Built at [GreatUniHack 2026](https://greatunihack-2026.devpost.com), University of Manchester, 7 November 2026.

## Team

| Name | GitHub | Role |
|---|---|---|
| Hamid Aziz (lead) | [@HamidZ11](https://github.com/HamidZ11) | AI agent |
| Ebube Onwuzurigbo | [@ebubeonwuzurigbo-spec](https://github.com/ebubeonwuzurigbo-spec) | Backend / API |
| Sam Stewart | [@TheSamStewart](https://github.com/TheSamStewart) | Frontend |
| Noumaan Syed | [@noumxan](https://github.com/noumxan) | Evals, guardrails + pitch |

## What it does

Viva explores a way to check a student's understanding of their own coursework alongside a module rubric. Its API extracts concepts and quotations, runs a short viva, lets the student correct Max's mistaken interpretation, and exposes session evidence for lecturers. In this snapshot the browser still shows the Echo prototype, while rubric checking, answer scoring, Guardian, the class heatmap and speech use stubs.

## How we built it

The backend is FastAPI with Pydantic validation and the Anthropic Python SDK. The frontend uses Next.js, React and Tailwind CSS. Max lives in the Examiner module, and sessions are held in memory, so restarting the backend loses them; run a single backend worker for the demo.

| Agent | Job in this snapshot | Never does |
|---|---|---|
| Reader | Extracts concepts, submission quotations and rubric criteria using Claude | Assigns a final academic mark |
| Checker | Returns fixed sample rubric colours and gap notes through a stub | Calculates a numerical mark |
| Max | Voices the student's claim as a fellow student and responds to corrections | Decides status through its generated dialogue |
| Examiner | Asks viva questions, follows up and controls the session modes | Makes a misconduct decision |
| Marker | Returns a colour using answer length through a stub | Establishes whether the student actually understands |
| Guardian | Removes HTML comments, records flags and exposes a stub agent log | Makes a final academic judgement |

```text
Next.js frontend (currently Echo)
  |
  v
FastAPI --> in-memory sessions --> lecturer reports
  |
  v
Reader / Checker* / Examiner + Max / Marker* / Guardian*
  |
  +--> Claude via Anthropic SDK (MODEL from .env)
  |
  +--> speech interface* --> ElevenLabs (not connected yet)

* Stub integration. The class heatmap also returns fixed demo data.
```

## Run it

Needs Python 3.11+ and Node 20.9+ with npm. From a fresh clone, open a terminal in the repo root:

```bash
cp .env.example .env
```

Edit `.env` to set `ANTHROPIC_API_KEY` and a `MODEL` available to your Anthropic account. The backend reads this root file automatically; shell environment variables take precedence. Without an Anthropic key, the API starts with additional stubs. Keep `.env` private. `ELEVENLABS_API_KEY` is reserved for the speech integration, which is still a stub in this snapshot.

**Backend** (http://localhost:8000):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend** (http://localhost:3000), in a second terminal:

```bash
cd frontend                  # from the repo root
cp .env.local.example .env.local
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open http://localhost:3000. `.env.local` sets `NEXT_PUBLIC_API_URL=http://localhost:8000`; restart Next.js if you change it. The current page exercises upload and Echo; the Viva flow is available through the API at http://localhost:8000/docs.

With the backend running, in a third terminal:

```bash
cd backend                  # from the repo root
source .venv/bin/activate
python -m app.agents.scripts.smoke_test
```

The smoke test uploads the sample essay and rubric from `backend/app/agents/samples/`, creates an Aisha Khan session, and checks Max, viva, reports, heatmap, agents, speech and `/health`. It starts no services and makes real Claude requests when configured. Each step prints its HTTP status and duration; any failed check returns exit code 1, including active stubs or unavailable speech. Use `--timeout 120` if a request needs longer than the default 60 seconds. Passing the injection check verifies the returned flag and quotations, rather than inspecting Claude's request payload.

For a frontend production build, run `npm run build` from `frontend/`. Check `curl http://localhost:8000/health` before the demo: HTTP 200 alone does not mean the integrations are real; `stubs` must be an empty list.

## Safety

The submission path removes the sample essay's hidden HTML instruction before essay analysis and retains an injection flag. This currently uses a narrow HTML-comment filter; rubric text is passed to Reader without that scan. Prompts also identify uploaded material as untrusted data.

Structured agent output is validated with Pydantic, Reader checks quotations against the submission with normalised typography and whitespace, and Examiner has fallback wording if generation fails. Full Guardian output enforcement is still a pass-through stub. The Echo prototype has separate rule-based input and output checks.

Colours, quotations and session transcripts are evidence for a human to review. A lecturer makes the final academic decision; the prototype does not issue a final mark or a misconduct verdict. Sessions have no authentication or durable storage, so use sample material on a local demo instance.

## Folder ownership

| Path | Owner |
|---|---|
| `backend/app/agents` | Hamid |
| `backend/app` (rest) | Ebube |
| `backend/app/guardrails.py`, `evals/` | Noumaan |
| `frontend/` | Sam |

## AI tools used

In line with the event rules, we're disclosing all AI use:

- **Claude (Anthropic API):** used inside the product
- **Claude Code / OpenAI Codex:** used as coding assistants during the build

## Sponsor tech

_NatWest · Anthropic · Firecrawl · ElevenLabs (to confirm once tracks are out)_
