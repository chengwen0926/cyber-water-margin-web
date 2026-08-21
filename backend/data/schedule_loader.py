from __future__ import annotations

from core.config import SCHEDULES_DIR
from models.schedule import DailySchedule


def load(day: int) -> DailySchedule:
    path = SCHEDULES_DIR / f"day_{day:02d}.json"
    if not path.exists():
        raise FileNotFoundError(f"no schedule configured for day {day}")
    return DailySchedule.model_validate_json(path.read_text(encoding="utf-8"))


def has_schedule(day: int) -> bool:
    return (SCHEDULES_DIR / f"day_{day:02d}.json").exists()
