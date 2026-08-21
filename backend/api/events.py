from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from core.events import broadcaster

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("")
async def stream_events(request: Request) -> StreamingResponse:
    queue = broadcaster.subscribe()

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    payload = json.dumps(event, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
