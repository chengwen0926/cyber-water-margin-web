from __future__ import annotations

from pydantic import BaseModel

from models.resume import ResumeField


class NPCProfile(BaseModel):
    npc_id: str
    npc_name: str
    npc_level: str
    archetype: str
    is_risk_target: bool = False
    avatar: str
    medical_fields: list[ResumeField]
    medical_report_scan_url: str
