from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from data import queue_store, save_manager
from models.settlement import CaseJudgement
from services import state_machine
from services.game_state_loader import build as build_game_state

router = APIRouter(prefix="/api/review", tags=["review"])


class VerdictRequest(BaseModel):
    verdict: Literal["approved", "rejected"]


@router.post("/{case_id}/verdict", response_model=CaseJudgement)
def submit_verdict(case_id: str, body: VerdictRequest) -> CaseJudgement:
    save = save_manager.read()
    day = max(save.current_day, 1)
    try:
        state = build_game_state(day, save)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if case_id not in state.cases:
        raise HTTPException(status_code=404, detail="case not found in today's queue")

    from services import verdict_checker

    judgement = verdict_checker.check(state, case_id, body.verdict)

    def mutate(s):
        s.case_verdicts[case_id] = body.verdict
        return s

    save_manager.update(mutate)

    queue = queue_store.load(day)
    if queue is not None:
        state_machine.mark_case_done(queue, case_id)

    return judgement
