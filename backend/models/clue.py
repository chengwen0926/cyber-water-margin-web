from __future__ import annotations

from pydantic import BaseModel


class Clue(BaseModel):
    clue_id: str
    case_id: str
    source: str
    description: str
    discovered: bool = False
