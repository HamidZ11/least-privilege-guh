"""Pre-generates demo audio into the TTS cache (memory + backend/app/.tts_cache).
Run from backend/: PYTHONPATH=. .venv/bin/python scripts/prewarm_tts.py
Lines must match what the app says word for word to hit the cache."""

import time

from app.tts import TTSError, synthesize

LINES = [
    ("examiner", "Hi Aisha, this is a short viva about your essay. There are no trick questions."),
    ("examiner", "Take your time. You can answer by voice or type, and I can rephrase any question."),
    ("examiner", "Thanks Aisha, that's the end of the viva. Here are three things worth revising before you submit."),
    ("examiner", "You wrote that the large sample proves social media causes anxiety. Walk me through why."),
    ("examiner", "You wrote that self-report is reliable because teenagers know how much time they spend online. Walk me through why."),
    ("max", "Hey Aisha! So I reckon a huge sample like that basically proves social media causes anxiety. You agree, right?"),
    ("max", "Self-report is fine though, isn't it? Teenagers know how long they spend online, so the numbers must be spot on."),
    ("max", "Oh, that makes sense. I had that wrong. Thanks for explaining it so clearly."),
]

failed = 0
for voice, text in LINES:
    start = time.perf_counter()
    try:
        synthesize(text, voice)
        status = "ok"
    except TTSError as error:
        status, failed = f"FAILED ({error})", failed + 1
    print(f"{time.perf_counter() - start:5.2f}s  {voice:8} {status}  {text[:55]}")
print(f"{len(LINES) - failed}/{len(LINES)} cached")
