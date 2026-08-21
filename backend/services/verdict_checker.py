from __future__ import annotations

from typing import Literal

from models.case import Case
from models.directive import DirectiveCondition
from models.game_state import GameState
from models.npc import NPCProfile
from models.settlement import CaseJudgement

Verdict = Literal["approved", "rejected"]


def _violates_review_rules(case: Case, state: GameState) -> bool:
    falsified_keys = {f.key for f in case.resume.fields if f.is_falsified}
    for rule in state.schedule.review_rules:
        if rule.severity != "reject_if_violated":
            continue
        if rule.field_key in falsified_keys:
            return True
    return False


def compute_correct_verdict(case: Case, state: GameState) -> Verdict:
    profile = state.npc_profiles.get(case.npc_id)
    if profile is not None and profile.npc_level not in state.schedule.allowed_npc_levels:
        return "rejected"
    if _violates_review_rules(case, state):
        return "rejected"
    return "approved"


def check(state: GameState, case_id: str, verdict: Verdict) -> CaseJudgement:
    case = state.cases[case_id]
    correct = compute_correct_verdict(case, state)
    return CaseJudgement(
        case_id=case_id,
        player_verdict=verdict,
        correct_verdict=correct,
        is_correct=verdict == correct,
    )


def condition_matches(
    condition: DirectiveCondition, case: Case, profile: NPCProfile
) -> bool:
    if condition.match_type == "npc_id":
        return profile.npc_id == condition.match_value
    if condition.match_type == "npc_archetype":
        return profile.archetype == condition.match_value
    if condition.match_type == "medical_field_value":
        for field in profile.medical_fields:
            if field.key == condition.match_key:
                return field.value == condition.match_value
        return False
    return False
