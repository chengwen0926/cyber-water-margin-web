from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _isolated_resources(tmp_path, monkeypatch):
    """Redirect all file-backed data stores to a temp directory so tests
    never read/write the real resources/json/ seed data."""
    import core.config as config

    tmp_resources = tmp_path / "resources_json"
    monkeypatch.setattr(config, "RESOURCES_DIR", tmp_resources)
    monkeypatch.setattr(config, "CASES_DIR", tmp_resources / "cases")
    monkeypatch.setattr(config, "NPC_PROFILES_DIR", tmp_resources / "npc_profiles")
    monkeypatch.setattr(config, "SCHEDULES_DIR", tmp_resources / "schedules")
    monkeypatch.setattr(config, "SCRIPTS_DIR", tmp_resources / "scripts")
    monkeypatch.setattr(config, "NPC_CHATS_DIR", tmp_resources / "scripts" / "npc_chats")
    monkeypatch.setattr(config, "BOSS_CALLS_PATH", tmp_resources / "scripts" / "boss_calls.json")
    monkeypatch.setattr(config, "PENALTY_RULES_PATH", tmp_resources / "penalty_rules.json")
    monkeypatch.setattr(config, "SAVE_PATH", tmp_resources / "save.json")
    monkeypatch.setattr(config, "EMAILS_PATH", tmp_resources / "emails.json")

    import data.case_loader as case_loader
    import data.npc_loader as npc_loader

    monkeypatch.setattr(case_loader, "CASES_DIR", tmp_resources / "cases")
    monkeypatch.setattr(npc_loader, "NPC_PROFILES_DIR", tmp_resources / "npc_profiles")
