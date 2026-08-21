from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class CaseJudgement(BaseModel):
    case_id: str
    player_verdict: Literal["approved", "rejected"]
    correct_verdict: Literal["approved", "rejected"]
    is_correct: bool


class DayResult(BaseModel):
    day: int
    judgements: list[CaseJudgement]
    total_count: int
    error_count: int
    error_rate: float
    directive_results: dict[str, bool] = {}
    penalty_triggered: "PenaltyRecord | None" = None
    is_final_day: bool = False


class PenaltyAction(BaseModel):
    action_type: Literal[
        "warning", "salary_deduction", "trigger_ending", "boss_call_scripted"
    ]
    action_payload: dict | None = None
    severity: int


class PenaltyRule(BaseModel):
    rule_id: str
    threshold_type: Literal[
        "single_day_error_rate", "consecutive_days", "cumulative_strikes"
    ]
    threshold_value: float
    consecutive_days_required: int | None = None
    penalty_action: PenaltyAction


class PenaltyRecord(BaseModel):
    day_triggered: int
    rule_id: str
    action: PenaltyAction


DayResult.model_rebuild()
