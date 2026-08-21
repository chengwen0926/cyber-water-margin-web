from __future__ import annotations

import random

from core.config import CANONICAL_FIELD_KEYS
from models.npc import NPCProfile
from models.resume import ResumeField
from models.schedule import DailySchedule

ARCHETYPES = ["honest", "nervous_liar", "confident_liar"]

_MEDICAL_VALUE_POOL: dict[str, list[str]] = {
    "gender": ["男", "女"],
    "health_status": ["体检合格", "轻度贫血", "隐瞒病史"],
    "marital_status": ["未婚", "已婚", "离异"],
    "graduation_year": ["2019", "2020", "2021", "2022"],
    "criminal_record": ["无犯罪记录", "有犯罪记录"],
    "prior_employment": ["首次求职", "有过跳槽记录", "曾被辞退"],
}

_FIELD_LABELS: dict[str, str] = {
    "gender": "性别",
    "health_status": "健康状况",
    "marital_status": "婚姻状况",
    "graduation_year": "毕业年份",
    "criminal_record": "犯罪记录",
    "prior_employment": "过往履历",
}

_NAME_POOL = ["武松", "林冲", "鲁智深", "杨志", "宋江", "李逵", "吴用", "花荣", "柴进", "阮小七"]


class NPCFactory:
    def generate(
        self,
        schedule: DailySchedule,
        rng: random.Random,
        npc_index: int,
        force_risk_target: bool = False,
    ) -> NPCProfile:
        npc_id = f"npc_{schedule.day}_{npc_index}"
        level = rng.choice(schedule.allowed_npc_levels or ["intern"])
        archetype = rng.choice(ARCHETYPES)
        is_risk_target = force_risk_target

        medical_fields = [
            ResumeField(
                key=key,
                label=_FIELD_LABELS[key],
                value=rng.choice(_MEDICAL_VALUE_POOL[key]),
                is_falsified=False,
                conflict_source=None,
            )
            for key in CANONICAL_FIELD_KEYS
        ]

        if is_risk_target:
            # A risk target always carries a concerning true value on at
            # least one field referenced by today's review rules.
            rule_keys = [r.field_key for r in schedule.review_rules] or CANONICAL_FIELD_KEYS
            target_key = rng.choice(rule_keys)
            for field in medical_fields:
                if field.key == target_key and target_key == "health_status":
                    field.value = "隐瞒病史"
                elif field.key == target_key and target_key == "criminal_record":
                    field.value = "有犯罪记录"
                elif field.key == target_key and target_key == "prior_employment":
                    field.value = "曾被辞退"

        return NPCProfile(
            npc_id=npc_id,
            npc_name=rng.choice(_NAME_POOL) + str(npc_index),
            npc_level=level,
            archetype=archetype,
            is_risk_target=is_risk_target,
            avatar=f"/avatars/{archetype}.png",
            medical_fields=medical_fields,
            medical_report_scan_url=f"/scans/{npc_id}.png",
        )
