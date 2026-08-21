from __future__ import annotations

import json

from core.config import BOSS_CALLS_PATH, NPC_CHATS_DIR
from models.chat import ChatScript


def load_all_boss_scripts() -> list[ChatScript]:
    if not BOSS_CALLS_PATH.exists():
        return []
    raw = json.loads(BOSS_CALLS_PATH.read_text(encoding="utf-8"))
    return [ChatScript.model_validate(item) for item in raw]


def load_all_npc_scripts() -> list[ChatScript]:
    return [
        ChatScript.model_validate_json(p.read_text(encoding="utf-8"))
        for p in sorted(NPC_CHATS_DIR.glob("*.json"))
    ]


def load_script(script_id: str) -> ChatScript:
    for script in load_all_boss_scripts() + load_all_npc_scripts():
        if script.script_id == script_id:
            return script
    raise FileNotFoundError(f"chat script not found: {script_id}")
