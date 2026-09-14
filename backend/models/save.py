from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from models.chat import ChatMessage
from models.settlement import DayResult, PenaltyRecord


class PlayerSave(BaseModel):
    desktop_items: list[dict] = Field(default_factory=list)
    desktop_settings: dict = Field(default_factory=lambda: {'brightness': 100, 'icon_size': 64, 'motion': True})
    archive_case_ids: list[str] | None = None
    friend_case_ids: list[str] | None = None
    archive_evidence: dict[str, list[dict]] = Field(default_factory=dict)
    read_receipts: dict[str, dict[str, str]] = Field(default_factory=dict)
    handled_call_revision: int = 0
    chat_call_revision: int = 0
    latest_boss_script_id: str | None = None
    current_day: int = 0
    unlocked_emails: list[str] = Field(default_factory=list)
    downloaded_attachments: list[str] = Field(default_factory=list)
    resume_field_flags: dict[str, list[str]] = Field(default_factory=dict)
    discovered_clues: list[str] = Field(default_factory=list)
    chat_progress: dict[str, str] = Field(default_factory=dict)
    conversation_progress: dict[str, str] = Field(default_factory=dict)
    chat_transcripts: dict[str, list[ChatMessage]] = Field(default_factory=dict)
    case_verdicts: dict[str, Literal["approved", "rejected"]] = Field(
        default_factory=dict
    )
    active_directives: list[str] = Field(default_factory=list)
    completed_directive_actions: dict[str, str] = Field(default_factory=dict)
    day_results: dict[int, DayResult] = Field(default_factory=dict)
    penalty_records: list[PenaltyRecord] = Field(default_factory=list)
    strikes: int = 0
