"""The one place that calls Claude."""

import json
import logging
import time
from functools import lru_cache
from typing import Any

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

MAX_TOKENS = 16000
MAX_ATTEMPTS = 2  # the first call plus at most one retry
RETRY_DELAY_SECONDS = 1
REQUEST_TIMEOUT_SECONDS = 120.0
RETRYABLE_ERRORS = (
    anthropic.APIConnectionError,
    anthropic.RateLimitError,
    anthropic.InternalServerError,
)


class LLMError(Exception):
    """The call failed. The message is safe to show to users."""


class LLMNotConfiguredError(LLMError):
    """ANTHROPIC_API_KEY is missing."""


@lru_cache(maxsize=1)
def _client() -> anthropic.Anthropic:
    if not settings.anthropic_api_key:
        raise LLMNotConfiguredError("ANTHROPIC_API_KEY is not set")
    # SDK retries are off so that MAX_ATTEMPTS is the real total.
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        max_retries=0,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


def _parse_json(text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(text)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def ask_claude(
    system: str,
    messages: list[dict[str, Any]],
    json_schema: dict[str, Any] | None = None,
) -> str | dict[str, Any]:
    """Return Claude's reply as text, or as a dict if json_schema is given.

    json_schema must be an object schema with "required" and
    "additionalProperties": false. Raises LLMError on failure.
    """
    client = _client()
    request: dict[str, Any] = {
        "model": settings.claude_model,
        "max_tokens": MAX_TOKENS,
        "system": system,
        "messages": messages,
    }
    if json_schema is not None:
        request["output_config"] = {
            "format": {"type": "json_schema", "schema": json_schema}
        }

    # Logs below record error types only, never request contents or keys.
    for attempt in range(1, MAX_ATTEMPTS + 1):
        if attempt > 1:
            time.sleep(RETRY_DELAY_SECONDS)

        try:
            response = client.messages.create(**request)
        except RETRYABLE_ERRORS as error:
            logger.warning(
                "Claude call failed: %s (attempt %d)", type(error).__name__, attempt
            )
            continue
        except anthropic.APIError as error:
            logger.error("Claude call rejected: %s", type(error).__name__)
            raise LLMError("Claude rejected the request") from error

        if response.stop_reason == "refusal":
            raise LLMError("Claude declined the request")

        text = "".join(
            block.text for block in response.content if block.type == "text"
        )
        if json_schema is None:
            return text

        data = _parse_json(text)
        if data is not None:
            return data
        logger.warning("Claude returned invalid JSON (attempt %d)", attempt)

    raise LLMError("Claude did not return a usable response")
