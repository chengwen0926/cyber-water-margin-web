from __future__ import annotations

from models.clue import Clue
from models.npc import NPCProfile
from models.resume import ResumeDocument


def diff_medical_vs_resume(
    profile: NPCProfile, resume: ResumeDocument
) -> list[Clue]:
    """Compare NPCProfile.medical_fields (ground truth) against the
    submitted resume by matching `key`, and produce a Clue for every
    mismatch found. This is the "医疗库比对" discovery step — the only way
    to catch text-field fraud (gender/health/marital/etc). It does not
    look at the resume photo; that's the archive's job."""
    truth_by_key = {f.key: f for f in profile.medical_fields}
    clues: list[Clue] = []
    for field in resume.fields:
        truth = truth_by_key.get(field.key)
        if truth is not None and truth.value != field.value:
            clues.append(
                Clue(
                    clue_id=f"clue_{resume.case_id}_{field.key}",
                    case_id=resume.case_id,
                    source="medical_diff",
                    description=(
                        f"简历中「{field.label}」填写为「{field.value}」，"
                        f"与体检库记录「{truth.value}」不符"
                    ),
                    discovered=True,
                )
            )
    return clues


def check_resume_photo(resume: ResumeDocument) -> Clue | None:
    """一键发现问题: the archive's automated check only ever inspects the
    resume photo for tampering — it cannot detect text-field lies, those
    require manually cross-checking against the medical library."""
    if not resume.photo.is_anomalous:
        return None
    return Clue(
        clue_id=f"clue_{resume.case_id}_photo",
        case_id=resume.case_id,
        source="photo_anomaly",
        description=resume.photo.anomaly_note or "简历照片存在异常",
        discovered=True,
    )
