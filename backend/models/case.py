from __future__ import annotations

from pydantic import BaseModel

from models.resume import ResumeDocument


class Case(BaseModel):
    case_id: str
    npc_id: str
    resume: ResumeDocument
    chat_script_id: str
