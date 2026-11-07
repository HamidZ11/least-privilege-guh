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

_Coming soon. Hacking starts 12:00._

## How we built it

_Stack, architecture and sponsor tools go here._

## Run it

Needs Python 3.11+ and Node 20+. From the repo root, copy the env file and add your `ANTHROPIC_API_KEY`:

```bash
cp .env.example .env
```

**Backend** (http://localhost:8000):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (http://localhost:3000), in a second terminal:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

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
