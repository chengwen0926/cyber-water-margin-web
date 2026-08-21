from __future__ import annotations

from pathlib import Path

from core.config import NPC_PROFILES_DIR
from models.npc import NPCProfile


def _path(npc_id: str) -> Path:
    return NPC_PROFILES_DIR / f"{npc_id}.json"


def load(npc_id: str) -> NPCProfile:
    path = _path(npc_id)
    if not path.exists():
        raise FileNotFoundError(f"npc profile not found: {npc_id}")
    return NPCProfile.model_validate_json(path.read_text(encoding="utf-8"))


def load_many(npc_ids: list[str]) -> dict[str, NPCProfile]:
    return {npc_id: load(npc_id) for npc_id in npc_ids}


def save(profile: NPCProfile) -> None:
    NPC_PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    _path(profile.npc_id).write_text(
        profile.model_dump_json(indent=2), encoding="utf-8"
    )
