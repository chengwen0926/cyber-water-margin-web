from __future__ import annotations

import json

from core.config import EMAILS_PATH
from models.email import Email


def load_all() -> list[Email]:
    if not EMAILS_PATH.exists():
        return []
    raw = json.loads(EMAILS_PATH.read_text(encoding="utf-8"))
    return [Email.model_validate(item) for item in raw]


def append(email: Email) -> None:
    emails = load_all()
    emails.append(email)
    EMAILS_PATH.write_text(
        json.dumps([e.model_dump() for e in emails], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
