from __future__ import annotations

from models.case import Case
from models.game_state import GameState
from models.npc import NPCProfile
from models.queue import DailyQueue
from models.resume import ResumeDocument, ResumeField, ResumePhoto
from models.save import PlayerSave
from models.schedule import DailySchedule, ReviewRule
from services import verdict_checker


def _make_state(resume_fields: list[ResumeField], medical_fields: list[ResumeField]) -> GameState:
    schedule = DailySchedule(
        day=1,
        npc_count=1,
        allowed_npc_levels=["intern"],
        review_rules=[
            ReviewRule(
                rule_id="r1",
                field_key="health_status",
                check_type="must_match_medical",
                description="核验健康状况",
                severity="reject_if_violated",
            )
        ],
    )
    profile = NPCProfile(
        npc_id="npc_1",
        npc_name="测试",
        npc_level="intern",
        archetype="honest",
        is_risk_target=False,
        avatar="/a.png",
        medical_fields=medical_fields,
        medical_report_scan_url="/s.png",
    )
    resume = ResumeDocument(
        case_id="case_1",
        fields=resume_fields,
        photo=ResumePhoto(photo_url="/p.png", is_anomalous=False),
        attachments=[],
        downloaded=True,
    )
    case = Case(case_id="case_1", npc_id="npc_1", resume=resume, chat_script_id="script_1")
    return GameState(
        day=1,
        schedule=schedule,
        queue=DailyQueue(day=1, entries=[]),
        cases={"case_1": case},
        npc_profiles={"npc_1": profile},
        active_directives=[],
        save=PlayerSave(),
    )


def test_rejects_when_falsified_field_violates_rule():
    medical = [ResumeField(key="health_status", label="健康状况", value="隐瞒病史")]
    resume = [
        ResumeField(
            key="health_status",
            label="健康状况",
            value="体检合格",
            is_falsified=True,
            conflict_source="npc_profile.medical_fields.health_status",
        )
    ]
    state = _make_state(resume, medical)
    judgement = verdict_checker.check(state, "case_1", "approved")
    assert judgement.correct_verdict == "rejected"
    assert judgement.is_correct is False


def test_approves_clean_case():
    medical = [ResumeField(key="health_status", label="健康状况", value="体检合格")]
    resume = [
        ResumeField(key="health_status", label="健康状况", value="体检合格", is_falsified=False)
    ]
    state = _make_state(resume, medical)
    judgement = verdict_checker.check(state, "case_1", "approved")
    assert judgement.correct_verdict == "approved"
    assert judgement.is_correct is True
