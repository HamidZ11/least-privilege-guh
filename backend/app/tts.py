"""ElevenLabs text-to-speech: two voices, in-memory cache.

synthesize() raises TTSError on a missing key or any failure. /api/tts turns that
into a 503 and the frontend falls back to text only. Keys are never logged.
"""

import hashlib
import logging
import os

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Premade ElevenLabs voices (work without voices_read): Rachel = calm, Josh = lighter.
DEFAULT_VOICES = {
    "examiner": "21m00Tcm4TlvDq8ikWAM",
    "max": "TxGEqnHWrfWFTfGW9XjX",
}
DEFAULT_MODEL = "eleven_flash_v2_5"  # low latency
API_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
TIMEOUT_SECONDS = 20.0

_cache: dict[str, bytes] = {}


class TTSError(Exception):
    """Speech could not be produced. The message is safe to show."""


def _voice_id(voice: str) -> str:
    if voice not in DEFAULT_VOICES:
        raise TTSError(f"Unknown voice '{voice}'. Use 'examiner' or 'max'.")
    env_name = f"ELEVENLABS_VOICE_{voice.upper()}"
    return os.getenv(env_name, "").strip() or DEFAULT_VOICES[voice]


def synthesize(text: str, voice: str) -> bytes:
    """Return MP3 bytes for text in the examiner or max voice."""
    if not text.strip():
        raise TTSError("Nothing to say")
    if not settings.elevenlabs_api_key:
        raise TTSError("ELEVENLABS_API_KEY is not set")

    voice_id = _voice_id(voice)
    model = os.getenv("ELEVENLABS_MODEL", "").strip() or DEFAULT_MODEL
    key = hashlib.sha256(f"{voice_id}|{model}|{text}".encode()).hexdigest()
    if key in _cache:
        return _cache[key]

    try:
        response = httpx.post(
            API_URL.format(voice_id=voice_id),
            headers={"xi-api-key": settings.elevenlabs_api_key, "accept": "audio/mpeg"},
            json={"text": text, "model_id": model},
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        logger.warning("ElevenLabs rejected the request: HTTP %s", error.response.status_code)
        raise TTSError("Voice is unavailable") from None
    except httpx.HTTPError as error:
        logger.warning("ElevenLabs call failed: %s", type(error).__name__)
        raise TTSError("Voice is unavailable") from None

    _cache[key] = response.content
    return response.content
