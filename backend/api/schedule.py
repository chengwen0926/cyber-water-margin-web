from __future__ import annotations

from fastapi import APIRouter, HTTPException

from data import save_manager, schedule_loader
from models.schedule import DailySchedule

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


@router.get("/today", response_model=DailySchedule)
def get_today_schedule() -> DailySchedule:
    save = save_manager.read()
    day = max(save.current_day, 1)
    try:
        return schedule_loader.load(day)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
