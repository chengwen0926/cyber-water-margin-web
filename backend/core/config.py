from __future__ import annotations

import json
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
RESOURCES_DIR = BACKEND_DIR / "resources" / "json"

CASES_DIR = RESOURCES_DIR / "cases"
NPC_PROFILES_DIR = RESOURCES_DIR / "npc_profiles"
SCHEDULES_DIR = RESOURCES_DIR / "schedules"
SCRIPTS_DIR = RESOURCES_DIR / "scripts"
NPC_CHATS_DIR = SCRIPTS_DIR / "npc_chats"
BOSS_CALLS_PATH = SCRIPTS_DIR / "boss_calls.json"
PENALTY_RULES_PATH = RESOURCES_DIR / "penalty_rules.json"
SAVE_PATH = RESOURCES_DIR / "save.json"
EMAILS_PATH = RESOURCES_DIR / "emails.json"

CORS_ORIGINS = ["http://localhost:3000"]

# Canonical field-key vocabulary shared by NPCProfile.medical_fields,
# ResumeDocument.fields and DailySchedule.review_rules.field_key.
CANONICAL_FIELD_KEYS = [
    "gender",
    "health_status",
    "marital_status",
    "graduation_year",
    "criminal_record",
    "prior_employment",
]

# Total number of playable days; the schedules/day_0N.json files 01..N must
# exist for N == TOTAL_DAYS. Advancing past the final day ends the game.
TOTAL_DAYS = 5


def ensure_dirs() -> None:
    for directory in (
        CASES_DIR,
        NPC_PROFILES_DIR,
        SCHEDULES_DIR,
        SCRIPTS_DIR,
        NPC_CHATS_DIR,
    ):
        directory.mkdir(parents=True, exist_ok=True)


def ensure_save_exists() -> None:
    ensure_dirs()
    if not SAVE_PATH.exists():
        from models.save import PlayerSave

        SAVE_PATH.write_text(
            PlayerSave().model_dump_json(indent=2), encoding="utf-8"
        )
    if not EMAILS_PATH.exists():
        EMAILS_PATH.write_text(json.dumps([], indent=2), encoding="utf-8")
