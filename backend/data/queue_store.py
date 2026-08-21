from __future__ import annotations

import json
from pathlib import Path

from core.config import RESOURCES_DIR
from models.queue import DailyQueue

QUEUES_DIR = RESOURCES_DIR / "queues"


def _path(day: int) -> Path:
    return QUEUES_DIR / f"day_{day:02d}.json"


def load(day: int) -> DailyQueue | None:
    path = _path(day)
    if not path.exists():
        return None
    return DailyQueue.model_validate_json(path.read_text(encoding="utf-8"))


def save(queue: DailyQueue) -> None:
    QUEUES_DIR.mkdir(parents=True, exist_ok=True)
    _path(queue.day).write_text(queue.model_dump_json(indent=2), encoding="utf-8")
