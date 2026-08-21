from __future__ import annotations

from pydantic import BaseModel


class ResumeField(BaseModel):
    key: str
    label: str
    value: str
    is_falsified: bool = False
    conflict_source: str | None = None


class ResumePhoto(BaseModel):
    photo_url: str
    is_anomalous: bool = False
    anomaly_note: str | None = None


class ResumeDocument(BaseModel):
    case_id: str
    fields: list[ResumeField]
    photo: ResumePhoto
    attachments: list[str] = []
    downloaded: bool = False
