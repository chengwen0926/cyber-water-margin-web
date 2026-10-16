from __future__ import annotations

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import archive, chat, day, directives, email, events, medical, review, schedule, settlement
from api import reading, workspace, game
from core.config import CORS_ORIGINS, ensure_save_exists

app = FastAPI(title="赛博水浒入职日 API")

# The game uses a single local save. Serialize requests while a multi-file
# reset runs; leave the long-lived event stream outside the lock.
_state_request_lock = asyncio.Lock()

@app.middleware("http")
async def serialize_game_state(request, call_next):
    if request.url.path.startswith("/api/") and not (request.method == "GET" and request.url.path == "/api/events"):
        async with _state_request_lock:
            return await call_next(request)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    ensure_save_exists()
    from services.email_migration import migrate_daily_emails
    migrate_daily_emails()
    from services.onboarding_story import ensure_story
    ensure_story()


app.include_router(schedule.router)
app.include_router(day.router)
app.include_router(email.router)
app.include_router(archive.router)
app.include_router(medical.router)
app.include_router(chat.router)
app.include_router(review.router)
app.include_router(directives.router)
app.include_router(settlement.router)
app.include_router(events.router)
app.include_router(reading.router)
app.include_router(workspace.router)
app.include_router(game.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
