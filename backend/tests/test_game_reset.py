from pathlib import Path
import shutil
import pytest
from fastapi import HTTPException
from core import config
from data import save_manager, email_loader, queue_store, script_loader, schedule_loader, case_loader
from models.save import PlayerSave
from api import game, day

@pytest.fixture
def stored_game(tmp_path, monkeypatch, _isolated_resources):
    root = config.RESOURCES_DIR
    assert root.is_relative_to(tmp_path)
    monkeypatch.setattr(save_manager, 'SAVE_PATH', root / 'save.json')
    monkeypatch.setattr(email_loader, 'EMAILS_PATH', root / 'emails.json')
    monkeypatch.setattr(queue_store, 'QUEUES_DIR', root / 'queues')
    monkeypatch.setattr(script_loader, 'NPC_CHATS_DIR', root / 'scripts/npc_chats')
    monkeypatch.setattr(script_loader, 'BOSS_CALLS_PATH', root / 'scripts/boss_calls.json')
    monkeypatch.setattr(schedule_loader, 'SCHEDULES_DIR', root / 'schedules')
    monkeypatch.setattr('services.chat_notifications.broadcaster.publish', lambda event: None)
    source = Path(__file__).parents[1] / 'resources/json'
    config.ensure_save_exists()
    for folder in ('scripts', 'schedules'):
        shutil.copytree(source / folder, root / folder, dirs_exist_ok=True)
    day.advance_day()
    save = save_manager.read()
    save.current_day = 3
    save.case_verdicts = {'case_1_0': 'approved'}
    save.desktop_items = [{'id':'old'}]
    save.chat_progress = {'old':'end'}
    save.strikes = 2
    save.desktop_settings['brightness'] = 72
    save_manager.write(save)
    return save


def test_reset_restarts_story_and_creates_backup(stored_game):
    result = game.reset_game(game.ResetRequest(confirmed=True))
    fresh = save_manager.read()
    assert fresh.current_day == 1
    assert not fresh.case_verdicts and not fresh.desktop_items and not fresh.chat_progress
    assert fresh.strikes == 0
    assert fresh.desktop_settings['brightness'] == 72
    assert fresh.latest_boss_script_id == 'boss_gaoqiu_onboarding_01'
    assert fresh.chat_call_revision > stored_game.chat_call_revision
    assert fresh.handled_call_revision < fresh.chat_call_revision
    assert fresh.friend_case_ids == [] and fresh.archive_case_ids == []
    assert case_loader.load('case_1_0').chat_script_id == 'npc_lvshi_interview_01'
    assert len(email_loader.load_all()) == 3
    backup = config.RESOURCES_DIR.parent / 'save_backups' / result['backup']
    assert PlayerSave.model_validate_json((backup / 'save.json').read_text()) == stored_game
    assert (backup / 'cases/case_1_0.json').exists()


def test_reset_without_confirmation_leaves_save(stored_game):
    with pytest.raises(HTTPException) as error:
        game.reset_game(game.ResetRequest())
    assert error.value.status_code == 400
    assert save_manager.read() == stored_game


def test_reset_failure_restores_all_progress(stored_game, monkeypatch):
    before = {str(p.relative_to(config.RESOURCES_DIR)):p.read_bytes() for p in config.RESOURCES_DIR.rglob('*.json')}
    def fail():
        raise RuntimeError('generation failed')
    monkeypatch.setattr(day, 'advance_day', fail)
    with pytest.raises(HTTPException) as error:
        game.reset_game(game.ResetRequest(confirmed=True))
    assert error.value.status_code == 500
    after = {str(p.relative_to(config.RESOURCES_DIR)):p.read_bytes() for p in config.RESOURCES_DIR.rglob('*.json')}
    assert before == after
