from __future__ import annotations

from models.game_state import GameState
from models.settlement import DayResult, PenaltyRecord, PenaltyRule


class PenaltyChecker:
    def evaluate(
        self, state: GameState, day_result: DayResult, rules: list[PenaltyRule]
    ) -> PenaltyRecord | None:
        triggered: list[PenaltyRule] = []

        for rule in rules:
            if rule.threshold_type == "single_day_error_rate":
                if day_result.error_rate >= rule.threshold_value:
                    triggered.append(rule)

            elif rule.threshold_type == "consecutive_days":
                n = rule.consecutive_days_required or 1
                days_to_check = [state.day - offset for offset in range(n)]
                past_results = [
                    state.save.day_results.get(d)
                    for d in days_to_check
                    if d != state.day
                ]
                all_results = past_results + [day_result]
                if len(all_results) >= n and all(
                    r is not None and r.error_rate >= rule.threshold_value
                    for r in all_results
                ):
                    triggered.append(rule)

            elif rule.threshold_type == "cumulative_strikes":
                if state.save.strikes >= rule.threshold_value:
                    triggered.append(rule)

        if not triggered:
            return None

        worst = max(triggered, key=lambda r: r.penalty_action.severity)
        return PenaltyRecord(
            day_triggered=state.day, rule_id=worst.rule_id, action=worst.penalty_action
        )
