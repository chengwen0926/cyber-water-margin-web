from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ReviewRule(BaseModel):
    rule_id: str
    field_key: str
    check_type: str
    description: str
    severity: Literal["reject_if_violated", "flag_only"]


class DailySchedule(BaseModel):
    day: int
    npc_count: int
    allowed_npc_levels: list[str]
    review_rules: list[ReviewRule]
