from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from data import case_loader, npc_loader, save_manager
from models.directive import SpecialDirective
from services import verdict_checker
from services.game_state_loader import load_active_directives

router = APIRouter(prefix="/api/directives", tags=["directives"])


class ExecuteRequest(BaseModel):
    case_id: str


@router.get("/active", response_model=list[SpecialDirective])
def active_directives() -> list[SpecialDirective]:
    save = save_manager.read()
    return load_active_directives(save, max(save.current_day, 1))


@router.post("/{directive_id}/execute")
def execute_directive(directive_id: str, body: ExecuteRequest) -> dict:
    save = save_manager.read()
    directives = {d.directive_id: d for d in load_active_directives(save, max(save.current_day, 1))}
    directive = directives.get(directive_id)
    if directive is None:
        raise HTTPException(status_code=404, detail="directive not active")

    try:
        case = case_loader.load(body.case_id)
        profile = npc_loader.load(case.npc_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not verdict_checker.condition_matches(directive.condition, case, profile):
        raise HTTPException(status_code=400, detail="条件不满足")

    def mutate(s):
        s.completed_directive_actions[directive_id] = directive.action.action_type
        return s

    save_manager.update(mutate)
    return {"executed": True, "action_type": directive.action.action_type}
