from __future__ import annotations

import json
from pathlib import Path

from core.config import CASES_DIR
from models.case import Case


def _path(case_id: str) -> Path:
    return CASES_DIR / f"{case_id}.json"


def load(case_id: str) -> Case:
    path = _path(case_id)
    if not path.exists():
        raise FileNotFoundError(f"case not found: {case_id}")
    return Case.model_validate_json(path.read_text(encoding="utf-8"))


def load_all() -> list[Case]:
    return [
        Case.model_validate_json(p.read_text(encoding="utf-8"))
        for p in sorted(CASES_DIR.glob("*.json"))
    ]


def load_many(case_ids: list[str]) -> dict[str, Case]:
    return {case_id: load(case_id) for case_id in case_ids}


def save(case: Case) -> None:
    CASES_DIR.mkdir(parents=True, exist_ok=True)
    _path(case.case_id).write_text(case.model_dump_json(indent=2), encoding="utf-8")


def load_all_for_day(day: int) -> list[Case]:
    prefix = f"case_{day}_"
    return [c for c in load_all() if c.case_id.startswith(prefix)]
