# Team rules for AI coding agents (read before every task)

Hackathon repo, 4 people working in parallel. Your job is to change ONLY your user's files and keep main working.

## Who owns what (all under backend/app/ unless noted)
- Hamid: main.py, parsing.py, agents/reader.py, agents/examiner.py, agents/scripts/
- Ebube: models.py, state.py, agents/checker.py, agents/marker.py, tts.py, heatmap.py
- Nüman: agents/guardian.py, brief.py, data/, evals/
- Sam: frontend/
- Shared (ask the user before editing): CLAUDE.md, README.md, requirements.txt, frontend/package.json, .gitignore, .env.example, design/DESIGN.md

Ask your user who they are if you don't know. Never edit another person's files. If your task needs a change there, STOP and write the exact change they need so your user can send it to them.

## Git
- Work only on the user's own branch (hamid/agents, ebube/api, sam/frontend, numan/guardrails). Never commit or push to main directly.
- Before starting a task: git checkout main && git pull origin main && git checkout <branch> && git merge main --no-edit
- Commit small and often with clear messages. Stage files by name, never "git add ." or "git add -A".
- Before every commit run git status and git diff --cached --stat, and show the user the list of files.
- Never commit: .env, .env.local, any API key, node_modules/, .venv/, .claude/, __pycache__/. If any are staged, unstage them and tell the user.
- Never: git push --force, git reset --hard, git rebase on shared branches, deleting branches, rewriting history.
- Merge conflicts: stop and show the user both sides. Never resolve by discarding someone else's code.
- Getting work into main: push the branch, then open a PR into main (gh pr create) only when the user asks. Merge order each round: Ebube → Hamid → Nüman → Sam.

## Code
- The shared contract (types + endpoints) in the team spec is fixed. Don't rename fields or endpoints. If it must change, stop and tell the user.
- Keep the backend starting and `npm run build` passing before every commit.
- No new dependencies without asking the user.
- Never call the Anthropic API with a temperature parameter. MODEL comes from .env.
- Never print, log or hardcode API keys.

## After feature freeze
Bug fixes only, smallest possible diff, and only after the user confirms Hamid approved it.
