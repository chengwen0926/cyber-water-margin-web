from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from data import save_manager
from services.chat_notifications import pending_call
from fastapi.responses import StreamingResponse

from core.events import broadcaster

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("")
async def stream_events(request: Request) -> StreamingResponse:
    queue = broadcaster.subscribe()

    async def event_generator():
        try:
            pending = pending_call()
            last_revision = pending["revision"] if pending else 0
            if pending:
                yield f"data: {json.dumps(pending, ensure_ascii=False)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    if event.get("event") == "incoming_call" and event.get("revision"):
                        if event["revision"] <= last_revision:
                            continue
                        last_revision = event["revision"]
                    payload = json.dumps(event, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class CallAcknowledgement(BaseModel):
    revision: int = Field(ge=1)


@router.post("/call/ack")
def acknowledge_call(body: CallAcknowledgement):
    def mutate(save):
        save.handled_call_revision = max(save.handled_call_revision, min(body.revision, save.chat_call_revision))
    save_manager.update(mutate)
    return {"ok": True}
