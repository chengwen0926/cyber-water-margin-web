from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from data import save_manager
from services.reading_state import snapshot

router = APIRouter(prefix="/api/reading", tags=["reading"])


class ReadRequest(BaseModel):
    channel: Literal["email", "archive", "medical", "chat"]
    item_id: str = Field(min_length=1, max_length=200)
    version: str = Field(min_length=1, max_length=500)


@router.get("")
def get_reading_state() -> dict:
    return snapshot(save_manager.read())


@router.post("")
def mark_read(body: ReadRequest) -> dict:
    def mutate(save):
        entry = snapshot(save)[body.channel].get(body.item_id)
        if entry is None:
            raise HTTPException(status_code=404, detail="content not available")
        if entry["version"] != body.version:
            raise HTTPException(status_code=409, detail="content changed; read the latest version")
        save.read_receipts.setdefault(body.channel, {})[body.item_id] = body.version

    save_manager.update(mutate)
    return {"version": body.version, "is_read": True}
