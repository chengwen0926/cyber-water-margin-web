from __future__ import annotations

from data import case_loader, directive_store, npc_loader, queue_store, schedule_loader
from models.directive import SpecialDirective
from models.game_state import GameState
from models.queue import DailyQueue
from models.save import PlayerSave


def load_active_directives(save: PlayerSave, day: int) -> list[SpecialDirective]:
    resolved: list[SpecialDirective] = []
    for directive_id in save.active_directives:
        directive = directive_store.load(directive_id)
        if directive is None:
            continue
        if directive.expires_day is not None and directive.expires_day < day:
            continue
        resolved.append(directive)
    return resolved


def _load_queue(day: int) -> DailyQueue:
    queue = queue_store.load(day)
    if queue is None:
        # No queue generated yet for this day.
        return DailyQueue(day=day, entries=[], generated_at_seed=None)
    return queue


def build(day: int, save: PlayerSave) -> GameState:
    schedule = schedule_loader.load(day)
    queue = _load_queue(day)
    cases = {c.case_id: c for c in case_loader.load_all_for_day(day)}
    npc_ids = [c.npc_id for c in cases.values()]
    npc_profiles = npc_loader.load_many(npc_ids)
    active_directives = load_active_directives(save, day)
    return GameState(
        day=day,
        schedule=schedule,
        queue=queue,
        cases=cases,
        npc_profiles=npc_profiles,
        active_directives=active_directives,
        save=save,
    )
