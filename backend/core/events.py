from __future__ import annotations

import asyncio
from typing import Any


class EventBroadcaster:
    """In-process pub/sub used to push SSE events (e.g. incoming boss calls)
    to any connected frontend clients. One asyncio.Queue per subscriber."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)

    def publish(self, event: dict[str, Any]) -> None:
        for queue in list(self._subscribers):
            queue.put_nowait(event)


broadcaster = EventBroadcaster()
