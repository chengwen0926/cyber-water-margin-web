from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from models.case import Case
from models.npc import NPCProfile


class QueueEntry(BaseModel):
    position: int
    case_id: str
    arrival_state: Literal["waiting", "in_review", "done"] = "waiting"


class DailyQueue(BaseModel):
    day: int
    entries: list[QueueEntry]
    generated_at_seed: int | None = None


class DailyGenerationResult(BaseModel):
    queue: DailyQueue
    cases: list[Case]
    npc_profiles: list[NPCProfile]
