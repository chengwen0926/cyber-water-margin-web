from __future__ import annotations

from fastapi import APIRouter, HTTPException

from core.config import TOTAL_DAYS
from services.chat_notifications import publish_call
from data import email_loader, queue_store, schedule_loader, script_loader
from models.email import Email, EmailAttachment
from models.queue import DailyGenerationResult, DailyQueue
from services.daily_queue_builder import DailyQueueBuilder

router = APIRouter(prefix="/api/day", tags=["day"])


def _daily_email(day: int, schedule, cases: list) -> Email:
    rules = "\n".join(f"• {rule.description}" for rule in schedule.review_rules)
    return Email(
        email_id=f"email_daily_{day}",
        day=day,
        sender="人事系统",
        subject=f"第{day}天工作安排与候选人简历",
        body=(
            f"今日共有 {schedule.npc_count} 位候选人前来面试，"
            f"允许通过级别：{'、'.join(schedule.allowed_npc_levels)}。\n\n"
            f"今日审查规则：\n{rules or '无特殊规则'}\n\n"
            "以下为今日待审查候选人的简历附件，请下载后前往档案系统查阅。"
        ),
        attachments=[EmailAttachment(
            attachment_id=f"attachment_{case.case_id}", case_id=case.case_id,
            filename=f"{case.case_id}_resume.pdf",
        ) for case in cases],
    )


@router.post("/advance", response_model=DailyGenerationResult)
def advance_day() -> DailyGenerationResult:
    from data import save_manager

    save = save_manager.read()
    if save.current_day >= TOTAL_DAYS:
        raise HTTPException(status_code=400, detail="game already ended, no more days to advance to")

    next_day = save.current_day + 1

    try:
        schedule = schedule_loader.load(next_day)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    existing_queue = queue_store.load(next_day)
    if existing_queue is not None:
        from data import case_loader, npc_loader

        cases = case_loader.load_all_for_day(next_day)
        profiles = npc_loader.load_many([c.npc_id for c in cases])
        save_manager.update(lambda s: _set_current_day(s, next_day))
        return DailyGenerationResult(
            queue=existing_queue, cases=cases, npc_profiles=list(profiles.values())
        )

    script_pool = script_loader.load_all_npc_scripts()
    result = DailyQueueBuilder().build(schedule, seed=next_day, script_pool=script_pool)
    queue_store.save(result.queue)
    email_loader.append(_daily_email(next_day, schedule, result.cases))

    save_manager.update(lambda s: _set_current_day(s, next_day))

    boss_scripts = script_loader.load_all_boss_scripts()
    if boss_scripts:
        publish_call(boss_scripts[0].script_id)

    return result


def _set_current_day(save, day: int):
    save.current_day = day
    return save


@router.get("/queue", response_model=DailyQueue)
def get_today_queue() -> DailyQueue:
    from data import save_manager

    save = save_manager.read()
    queue = queue_store.load(max(save.current_day, 1))
    if queue is None:
        return DailyQueue(day=max(save.current_day, 1), entries=[], generated_at_seed=None)
    return queue
