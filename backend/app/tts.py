"""ElevenLabs text-to-speech: two voices, memory + disk cache.

synthesize() raises TTSError on a missing key or any failure. /api/tts turns that
into a 503 and the frontend falls back to text only. Keys are never logged.
"""

import hashlib
import logging
import os
from pathlib import Path

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
TIMEOUT_SECONDS = 8.0  # fail fast so the UI falls back to text
CACHE_DIR = Path(__file__).parent / ".tts_cache"  # audio here is gitignored

_cache: dict[str, bytes] = {}


class TTSError(Exception):
    """Speech could not be produced. The message is safe to show."""


def _read_disk(key: str) -> bytes | None:
    try:
        return (CACHE_DIR / f"{key}.mp3").read_bytes() or None
    except OSError:
        return None


def _write_disk(key: str, audio: bytes) -> None:
    # A disk problem must never break speech, so errors are ignored. Write then
    # rename so a crash can't leave a half-written file to be served later.
    try:
        CACHE_DIR.mkdir(exist_ok=True)
        (CACHE_DIR / ".gitignore").write_text("*\n!.gitignore\n")
        tmp = CACHE_DIR / f"{key}.tmp"
        tmp.write_bytes(audio)
        tmp.replace(CACHE_DIR / f"{key}.mp3")
    except OSError as error:
        logger.warning("Could not write TTS cache: %s", type(error).__name__)


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
    audio = _read_disk(key)
    if audio is not None:
        _cache[key] = audio
        return audio

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
    _write_disk(key, response.content)
    return response.content
