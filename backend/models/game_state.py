from __future__ import annotations

from pydantic import BaseModel

from models.case import Case
from models.directive import SpecialDirective
from models.npc import NPCProfile
from models.queue import DailyQueue
from models.save import PlayerSave
from models.schedule import DailySchedule


class GameState(BaseModel):
    day: int
    schedule: DailySchedule
    queue: DailyQueue
    cases: dict[str, Case]
    npc_profiles: dict[str, NPCProfile]
    active_directives: list[SpecialDirective]
    save: PlayerSave
