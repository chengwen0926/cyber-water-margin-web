from __future__ import annotations

import json

from core.config import RESOURCES_DIR
from models.directive import SpecialDirective

DIRECTIVES_PATH = RESOURCES_DIR / "directives.json"


def load_all_templates() -> list[SpecialDirective]:
    """Static directive templates authored by 策划, keyed by directive_id.
    `day_issued` in the template file is a placeholder; the real value is
    stamped in when the directive is actually revealed (see
    services.state_machine.materialize_directive)."""
    if not DIRECTIVES_PATH.exists():
        return []
    raw = json.loads(DIRECTIVES_PATH.read_text(encoding="utf-8"))
    return [SpecialDirective.model_validate(item) for item in raw]


def load_template(directive_id: str) -> SpecialDirective | None:
    for directive in load_all_templates():
        if directive.directive_id == directive_id:
            return directive
    return None
