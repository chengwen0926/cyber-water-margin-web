from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class DirectiveCondition(BaseModel):
    match_type: Literal["npc_archetype", "npc_id", "medical_field_value"]
    match_key: str
    match_value: str


class DirectiveAction(BaseModel):
    action_type: Literal[
        "secret_report", "force_reject", "force_approve", "flag_for_followup"
    ]
    action_payload: dict | None = None


class SpecialDirective(BaseModel):
    directive_id: str
    triggered_by_chat_script_id: str
    day_issued: int
    condition: DirectiveCondition
    action: DirectiveAction
    covert: bool = False
    expires_day: int | None = None
