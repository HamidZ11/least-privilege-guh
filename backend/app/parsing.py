"""Turn an uploaded file into plain text. PDFs go through pypdf; text and code
files pass straight through."""

import logging
from io import BytesIO

from pypdf import PdfReader

logger = logging.getLogger(__name__)

FALLBACK_HINT = "Please paste your text instead."


class ParseError(ValueError):
    """The file can't be read. The message is safe to show to students."""


def _is_pdf(filename: str | None, raw: bytes) -> bool:
    return raw.startswith(b"%PDF-") or (filename or "").lower().endswith(".pdf")


def _pdf_text(raw: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(raw))
        if reader.is_encrypted and not reader.decrypt(""):
            raise ParseError(f"This PDF is password protected. {FALLBACK_HINT}")
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except ParseError:
        raise
    except Exception as error:  # pypdf raises many types on malformed files
        logger.warning("PDF parse failed: %s", type(error).__name__)
        raise ParseError(f"We couldn't read this PDF. {FALLBACK_HINT}") from None
    if not text.strip():
        raise ParseError(f"This PDF has no selectable text. {FALLBACK_HINT}")
    return text


def extract_text(filename: str | None, raw: bytes) -> str:
    """Return the file's text, or raise ParseError."""
    if _is_pdf(filename, raw):
        return _pdf_text(raw)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ParseError(f"We can only read PDF and text files. {FALLBACK_HINT}") from None
    if "\x00" in text:
        raise ParseError(f"We can only read PDF and text files. {FALLBACK_HINT}")
    return text
