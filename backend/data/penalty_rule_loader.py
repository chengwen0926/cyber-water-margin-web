from __future__ import annotations

import json

from core.config import PENALTY_RULES_PATH
from models.settlement import PenaltyRule


def load_all() -> list[PenaltyRule]:
    if not PENALTY_RULES_PATH.exists():
        return []
    raw = json.loads(PENALTY_RULES_PATH.read_text(encoding="utf-8"))
    return [PenaltyRule.model_validate(item) for item in raw]
