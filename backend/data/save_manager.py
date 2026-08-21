from __future__ import annotations

from collections.abc import Callable

import portalocker

from core.config import SAVE_PATH, ensure_save_exists
from models.save import PlayerSave


def read() -> PlayerSave:
    ensure_save_exists()
    with portalocker.Lock(str(SAVE_PATH), "r", timeout=5) as f:
        content = f.read()
    return PlayerSave.model_validate_json(content)


def write(save: PlayerSave) -> None:
    ensure_save_exists()
    with portalocker.Lock(str(SAVE_PATH), "r+", timeout=5) as f:
        f.seek(0)
        f.write(save.model_dump_json(indent=2))
        f.truncate()


def update(fn: Callable[[PlayerSave], PlayerSave | None]) -> PlayerSave:
    """Atomic read-modify-write. `fn` receives the current save and may
    mutate+return it (or return a new instance); the lock is held for the
    full cycle so concurrent requests can't race each other."""
    ensure_save_exists()
    with portalocker.Lock(str(SAVE_PATH), "r+", timeout=5) as f:
        f.seek(0)
        current = PlayerSave.model_validate_json(f.read())
        result = fn(current)
        updated = result if result is not None else current
        f.seek(0)
        f.write(updated.model_dump_json(indent=2))
        f.truncate()
    return updated
