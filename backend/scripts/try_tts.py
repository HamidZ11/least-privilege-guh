"""Writes examiner.mp3 and max.mp3 to the current directory.
Run from backend/: PYTHONPATH=. .venv/bin/python scripts/try_tts.py"""

from app.tts import TTSError, synthesize

LINES = {
    "examiner": "You wrote that the large sample proves causation. Walk me through why.",
    "max": "Honestly, I reckon a big sample just proves it, right?",
}

for voice, text in LINES.items():
    try:
        audio = synthesize(text, voice)
    except TTSError as error:
        print(f"{voice}: failed ({error})")
        continue
    with open(f"{voice}.mp3", "wb") as f:
        f.write(audio)
    print(f"{voice}: wrote {voice}.mp3 ({len(audio):,} bytes)")
