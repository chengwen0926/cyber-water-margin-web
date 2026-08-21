from __future__ import annotations

from fastapi import APIRouter, HTTPException

from data import case_loader, npc_loader, save_manager
from models.npc import NPCProfile
from services import clue_manager

router = APIRouter(prefix="/api/medical", tags=["medical"])


def build_medical_record_view(profile: NPCProfile) -> dict:
    return {
        "npc_id": profile.npc_id,
        "fields": [f.model_dump() for f in profile.medical_fields],
        "report_scan_url": profile.medical_report_scan_url,
    }


@router.get("/{npc_id}")
def get_medical_record(npc_id: str) -> dict:
    try:
        profile = npc_loader.load(npc_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return build_medical_record_view(profile)


@router.post("/{npc_id}/compare/{case_id}")
def compare_with_resume(npc_id: str, case_id: str) -> dict:
    try:
        profile = npc_loader.load(npc_id)
        case = case_loader.load(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    clues = clue_manager.diff_medical_vs_resume(profile, case.resume)

    def mutate(s):
        for clue in clues:
            if clue.clue_id not in s.discovered_clues:
                s.discovered_clues.append(clue.clue_id)
        return s

    save_manager.update(mutate)
    return {"mismatches": [c.model_dump() for c in clues]}
