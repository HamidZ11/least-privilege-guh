"""Settings loaded from the repo-root .env. Shell variables take precedence."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _env(name: str) -> str | None:
    # .env.example ships blank values, so treat empty the same as unset.
    return os.getenv(name, "").strip() or None


@dataclass(frozen=True)
class Settings:
    # repr=False keeps keys out of logs and tracebacks that print settings.
    anthropic_api_key: str | None = field(repr=False)
    elevenlabs_api_key: str | None = field(repr=False)
    claude_model: str
    judge_model: str  # Checker and Marker, whose verdicts students see


settings = Settings(
    anthropic_api_key=_env("ANTHROPIC_API_KEY"),
    elevenlabs_api_key=_env("ELEVENLABS_API_KEY"),
    claude_model=_env("MODEL") or _env("CLAUDE_MODEL") or "claude-haiku-5-5",
    judge_model=_env("JUDGE_MODEL") or "claude-sonnet-5-5",
)
