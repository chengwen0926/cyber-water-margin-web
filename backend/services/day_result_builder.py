from __future__ import annotations

from core.config import TOTAL_DAYS
from models.game_state import GameState
from models.settlement import CaseJudgement, DayResult
from services import verdict_checker


def build(state: GameState) -> DayResult:
    judgements: list[CaseJudgement] = []
    for entry in state.queue.entries:
        verdict = state.save.case_verdicts.get(entry.case_id)
        if verdict is None:
            continue
        judgements.append(verdict_checker.check(state, entry.case_id, verdict))

    total = len(judgements)
    errors = sum(1 for j in judgements if not j.is_correct)
    error_rate = (errors / total) if total else 0.0

    directive_results = {
        d.directive_id: d.directive_id in state.save.completed_directive_actions
        for d in state.active_directives
    }

    return DayResult(
        day=state.day,
        judgements=judgements,
        total_count=total,
        error_count=errors,
        error_rate=error_rate,
        directive_results=directive_results,
        penalty_triggered=None,
        is_final_day=state.day >= TOTAL_DAYS,
    )
