from __future__ import annotations

from pydantic import BaseModel


class EmailAttachment(BaseModel):
    attachment_id: str
    case_id: str
    filename: str


class Email(BaseModel):
    email_id: str
    day: int
    sender: str
    subject: str
    body: str
    attachments: list[EmailAttachment] = []
