from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import archive, chat, day, directives, email, events, medical, review, schedule, settlement
from api import reading
from core.config import CORS_ORIGINS, ensure_save_exists

app = FastAPI(title="赛博水浒入职日 API")

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


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
