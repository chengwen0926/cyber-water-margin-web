from __future__ import annotations

import json
from pathlib import Path

from core.config import RESOURCES_DIR
from models.directive import SpecialDirective

DIRECTIVE_INSTANCES_DIR = RESOURCES_DIR / "directive_instances"


def _path(directive_id: str) -> Path:
    return DIRECTIVE_INSTANCES_DIR / f"{directive_id}.json"


def load(directive_id: str) -> SpecialDirective | None:
    path = _path(directive_id)
    if not path.exists():
        return None
    return SpecialDirective.model_validate_json(path.read_text(encoding="utf-8"))


def save(directive: SpecialDirective) -> None:
    DIRECTIVE_INSTANCES_DIR.mkdir(parents=True, exist_ok=True)
    _path(directive.directive_id).write_text(
        directive.model_dump_json(indent=2), encoding="utf-8"
    )
