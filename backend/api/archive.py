from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from data import case_loader, npc_loader, save_manager
from services import clue_manager

router = APIRouter(prefix="/api/archive", tags=["archive"])


class ArchiveSummary(BaseModel):
    case_id: str
    npc_id: str
    npc_name: str
    npc_level: str
    avatar: str
    verdict: str | None = None


class FlagRequest(BaseModel):
    field_key: str


@router.get("", response_model=list[ArchiveSummary])
def list_archive() -> list[ArchiveSummary]:
    save = save_manager.read()
    summaries = []
    for case in case_loader.load_all():
        if (case.case_id not in save.archive_case_ids) if save.archive_case_ids is not None else (not case.resume.downloaded):
            continue
        try:
            profile = npc_loader.load(case.npc_id)
        except FileNotFoundError:
            continue
        summaries.append(
            ArchiveSummary(
                case_id=case.case_id,
                npc_id=profile.npc_id,
                npc_name=profile.npc_name,
                npc_level=profile.npc_level,
                avatar=profile.avatar,
                verdict=save.case_verdicts.get(case.case_id),
            )
        )
    return summaries


@router.get("/{case_id}")
def get_archive_detail(case_id: str) -> dict:
    try:
        case = case_loader.load(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    save = save_manager.read()
    flagged = save.resume_field_flags.get(case_id, [])
    return {
        "case": case.model_dump(),
        "flagged_field_keys": flagged,
    }


@router.post("/{case_id}/auto-flag")
def auto_flag(case_id: str) -> dict:
    """一键发现问题: only ever inspects the resume photo for tampering.
    Text-field lies (gender/health/marital/etc) are not detectable here —
    the player must cross-check those manually in the medical library."""
    try:
        case = case_loader.load(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    photo_clue = clue_manager.check_resume_photo(case.resume)

    def mutate(s):
        if photo_clue and photo_clue.clue_id not in s.discovered_clues:
            s.discovered_clues.append(photo_clue.clue_id)
        return s

    save_manager.update(mutate)
    return {
        "photo_is_anomalous": case.resume.photo.is_anomalous,
        "clue": photo_clue.model_dump() if photo_clue else None,
    }


@router.post("/{case_id}/flag")
def flag_field(case_id: str, body: FlagRequest) -> dict:
    try:
        case_loader.load(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    def mutate(s):
        current = s.resume_field_flags.get(case_id, [])
        if body.field_key not in current:
            current.append(body.field_key)
        s.resume_field_flags[case_id] = current
        return s

    save = save_manager.update(mutate)
    return {"flagged_field_keys": save.resume_field_flags.get(case_id, [])}
