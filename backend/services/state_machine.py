from __future__ import annotations

from data import directive_loader, directive_store, queue_store
from models.directive import SpecialDirective
from models.queue import DailyQueue
from models.save import PlayerSave


def mark_case_done(queue: DailyQueue, case_id: str) -> DailyQueue:
    for entry in queue.entries:
        if entry.case_id == case_id:
            entry.arrival_state = "done"
    queue_store.save(queue)
    return queue


def mark_case_in_review(queue: DailyQueue, case_id: str) -> DailyQueue:
    for entry in queue.entries:
        if entry.case_id == case_id:
            if entry.arrival_state == "waiting":
                entry.arrival_state = "in_review"
    queue_store.save(queue)
    return queue


def materialize_directive(
    directive_id: str, day_issued: int, save: PlayerSave
) -> SpecialDirective:
    """A boss-call dialogue node revealed a directive template; stamp the
    real day_issued/expires_day and persist it as a concrete instance, then
    register it as active in the save."""
    template = directive_loader.load_template(directive_id)
    if template is None:
        raise ValueError(f"unknown directive template: {directive_id}")
    directive = template.model_copy(update={"day_issued": day_issued})
    directive_store.save(directive)
    if directive_id not in save.active_directives:
        save.active_directives.append(directive_id)
    return directive


def all_entries_done(queue: DailyQueue) -> bool:
    return bool(queue.entries) and all(e.arrival_state == "done" for e in queue.entries)
