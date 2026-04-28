from __future__ import annotations

import re
import string


URL_PATTERN = re.compile(r"http\S+|www\S+|https\S+", flags=re.IGNORECASE)
MENTION_PATTERN = re.compile(r"@\w+")
HASHTAG_PATTERN = re.compile(r"#\w+")
WHITESPACE_PATTERN = re.compile(r"\s+")


def clean_text(text: str) -> str:
    """Mirror the notebook preprocessing so deployed inference stays compatible."""
    cleaned = text.lower()
    cleaned = URL_PATTERN.sub("", cleaned)
    cleaned = MENTION_PATTERN.sub("", cleaned)
    cleaned = HASHTAG_PATTERN.sub("", cleaned)
    cleaned = cleaned.encode("ascii", "ignore").decode()
    cleaned = cleaned.translate(str.maketrans("", "", string.punctuation))
    cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip()
    return cleaned


def batch_clean_text(texts: list[str]) -> list[str]:
    return [clean_text(text) for text in texts]
