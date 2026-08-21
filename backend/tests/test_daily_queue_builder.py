from __future__ import annotations

from models.chat import ChatScript, DialogueNode
from models.schedule import DailySchedule, ReviewRule
from services.daily_queue_builder import DailyQueueBuilder


def _script_pool() -> list[ChatScript]:
    node = DialogueNode(node_id="start", speaker="npc", text="hi", options=[])
    return [
        ChatScript(
            script_id=f"script_{level}_{archetype}",
            participant="npc",
            archetype_tags=[level, archetype, risk],
            nodes={"start": node},
            start_node_id="start",
        )
        for level in ["intern", "staff"]
        for archetype in ["honest", "nervous_liar", "confident_liar"]
        for risk in ["normal", "risk_target"]
    ]


def _schedule() -> DailySchedule:
    return DailySchedule(
        day=1,
        npc_count=5,
        allowed_npc_levels=["intern", "staff"],
        review_rules=[
            ReviewRule(
                rule_id="r1",
                field_key="health_status",
                check_type="must_match_medical",
                description="d",
                severity="reject_if_violated",
            )
        ],
    )


def test_deterministic_with_same_seed():
    schedule = _schedule()
    pool = _script_pool()
    result_a = DailyQueueBuilder().build(schedule, seed=42, script_pool=pool)
    result_b = DailyQueueBuilder().build(schedule, seed=42, script_pool=pool)

    assert [c.model_dump() for c in result_a.cases] == [c.model_dump() for c in result_b.cases]
    assert [p.model_dump() for p in result_a.npc_profiles] == [
        p.model_dump() for p in result_b.npc_profiles
    ]
    assert result_a.queue.model_dump() == result_b.queue.model_dump()


def test_exactly_one_risk_target_when_npc_count_positive():
    schedule = _schedule()
    pool = _script_pool()
    result = DailyQueueBuilder().build(schedule, seed=7, script_pool=pool)
    risk_targets = [p for p in result.npc_profiles if p.is_risk_target]
    assert len(risk_targets) == 1
