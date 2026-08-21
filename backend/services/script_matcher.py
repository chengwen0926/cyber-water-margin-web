from __future__ import annotations

import random

from models.chat import ChatScript
from models.npc import NPCProfile


class ScriptMatcher:
    def pick(
        self, profile: NPCProfile, pool: list[ChatScript], rng: random.Random
    ) -> str:
        tags = {
            profile.npc_level,
            profile.archetype,
            "risk_target" if profile.is_risk_target else "normal",
        }
        candidates = [s for s in pool if set(s.archetype_tags) <= tags]
        if not candidates:
            # Fall back to the loosest match available so generation never
            # fails outright even if seed script coverage is sparse.
            candidates = [
                s for s in pool if profile.archetype in s.archetype_tags
            ] or pool
        if not candidates:
            raise ValueError("no npc chat scripts available to match against")
        return rng.choice(candidates).script_id
