from __future__ import annotations

import random

from data import case_loader, npc_loader
from models.case import Case
from models.chat import ChatScript
from models.queue import DailyGenerationResult, DailyQueue, QueueEntry
from models.schedule import DailySchedule
from services.npc_factory import NPCFactory
from services.resume_factory import ResumeFactory
from services.script_matcher import ScriptMatcher


class DailyQueueBuilder:
    def build(
        self,
        schedule: DailySchedule,
        seed: int,
        script_pool: list[ChatScript],
    ) -> DailyGenerationResult:
        rng = random.Random(seed)
        risk_index = rng.randrange(schedule.npc_count) if schedule.npc_count else -1

        cases: list[Case] = []
        profiles = []
        for i in range(schedule.npc_count):
            profile = NPCFactory().generate(
                schedule, rng, npc_index=i, force_risk_target=(i == risk_index)
            )
            case_id = f"case_{schedule.day}_{i}"
            resume = ResumeFactory().generate(profile, schedule, case_id, rng)
            script_id = ScriptMatcher().pick(profile, script_pool, rng)
            if schedule.day == 1 and i == 0 and any(s.script_id == "npc_lvshi_interview_01" for s in script_pool):
                profile.npc_name = "吕师"
                profile.employee_id = "NET-0311"
                script_id = "npc_lvshi_interview_01"
            case = Case(
                case_id=case_id,
                npc_id=profile.npc_id,
                resume=resume,
                chat_script_id=script_id,
            )
            cases.append(case)
            profiles.append(profile)

        for case in cases:
            case_loader.save(case)
        for profile in profiles:
            npc_loader.save(profile)

        queue = DailyQueue(
            day=schedule.day,
            entries=[
                QueueEntry(position=i, case_id=c.case_id, arrival_state="waiting")
                for i, c in enumerate(cases)
            ],
            generated_at_seed=seed,
        )
        return DailyGenerationResult(queue=queue, cases=cases, npc_profiles=profiles)
