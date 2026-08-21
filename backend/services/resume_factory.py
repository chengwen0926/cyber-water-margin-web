from __future__ import annotations

import random

from models.npc import NPCProfile
from models.resume import ResumeDocument, ResumeField, ResumePhoto
from models.schedule import DailySchedule

_PHOTO_ANOMALY_NOTES = [
    "照片存在明显PS痕迹，边缘不自然",
    "照片背景与证件照标准不符，疑似拼接",
    "照片人像与本人存在明显差异",
]


class ResumeFactory:
    def generate(
        self, profile: NPCProfile, schedule: DailySchedule, case_id: str, rng: random.Random
    ) -> ResumeDocument:
        rule_keys = {r.field_key for r in schedule.review_rules}
        fields: list[ResumeField] = []
        for truth_field in profile.medical_fields:
            falsify = False
            # Bias falsification toward fields the day's rules actually check,
            # so the review rules and the fraud always line up.
            if profile.is_risk_target and truth_field.key in rule_keys:
                falsify = True
            elif truth_field.key in rule_keys:
                falsify = rng.random() < 0.35
            else:
                falsify = rng.random() < 0.1

            if falsify:
                value = self._plausible_lie(truth_field.key, truth_field.value)
                fields.append(
                    ResumeField(
                        key=truth_field.key,
                        label=truth_field.label,
                        value=value,
                        is_falsified=True,
                        conflict_source=f"npc_profile.medical_fields.{truth_field.key}",
                    )
                )
            else:
                fields.append(
                    ResumeField(
                        key=truth_field.key,
                        label=truth_field.label,
                        value=truth_field.value,
                        is_falsified=False,
                        conflict_source=None,
                    )
                )

        photo = self._generate_photo(profile, case_id, rng)

        return ResumeDocument(
            case_id=case_id,
            fields=fields,
            photo=photo,
            attachments=[f"{case_id}_resume.pdf"],
            downloaded=False,
        )

    @staticmethod
    def _generate_photo(
        profile: NPCProfile, case_id: str, rng: random.Random
    ) -> ResumePhoto:
        # Photo doctoring is an independent tell from the text-field lies —
        # "一键发现问题" only inspects this, everything else must be
        # cross-checked against the medical library by hand.
        anomaly_chance = 0.6 if profile.is_risk_target else 0.2
        is_anomalous = rng.random() < anomaly_chance
        return ResumePhoto(
            photo_url=f"/resume_photos/{case_id}.png",
            is_anomalous=is_anomalous,
            anomaly_note=rng.choice(_PHOTO_ANOMALY_NOTES) if is_anomalous else None,
        )

    @staticmethod
    def _plausible_lie(key: str, truth_value: str) -> str:
        lies = {
            "gender": {"男": "女", "女": "男"}.get(truth_value, truth_value),
            "health_status": "体检合格",
            "marital_status": "未婚",
            "graduation_year": "2022",
            "criminal_record": "无犯罪记录",
            "prior_employment": "首次求职",
        }
        lie = lies.get(key, truth_value)
        return lie if lie != truth_value else truth_value + "（存疑）"
