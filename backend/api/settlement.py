from __future__ import annotations

from fastapi import APIRouter, HTTPException

from services.chat_notifications import publish_call
from data import penalty_rule_loader, save_manager, script_loader
from models.settlement import DayResult
from services import day_result_builder
from services.game_state_loader import build as build_game_state
from services.penalty_checker import PenaltyChecker

router = APIRouter(prefix="/api/settlement", tags=["settlement"])


@router.post("/today", response_model=DayResult)
def settle_today() -> DayResult:
    save = save_manager.read()
    day = max(save.current_day, 1)
    try:
        state = build_game_state(day, save)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    result = day_result_builder.build(state)
    rules = penalty_rule_loader.load_all()
    penalty = PenaltyChecker().evaluate(state, result, rules)
    result.penalty_triggered = penalty

    def mutate(s):
        s.day_results[day] = result
        if penalty is not None:
            s.penalty_records.append(penalty)
            s.strikes += 1
        return s

    save_manager.update(mutate)

    if penalty is not None and penalty.action.action_type == "boss_call_scripted":
        script_id = None
        if penalty.action.action_payload:
            script_id = penalty.action.action_payload.get("chat_script_id")
        if script_id is None:
            boss_scripts = script_loader.load_all_boss_scripts()
            script_id = boss_scripts[0].script_id if boss_scripts else None
        if script_id:
            publish_call(script_id)

    return result


@router.get("/{day}", response_model=DayResult)
def get_settlement(day: int) -> DayResult:
    save = save_manager.read()
    result = save.day_results.get(day)
    if result is None:
        raise HTTPException(status_code=404, detail="no settlement for that day")
    return result
