import json
from pathlib import Path
import random
import pytest
from models.chat import ChatScript
from models.save import PlayerSave
from services.daily_queue_builder import DailyQueueBuilder
from services.script_matcher import ScriptMatcher
from services.onboarding_story import ensure_story
from data import save_manager, email_loader, case_loader, npc_loader
from tests.test_daily_queue_builder import _schedule

ROOT = Path(__file__).parents[1] / 'resources/json/scripts'

@pytest.fixture(autouse=True)
def isolated_story(tmp_path, monkeypatch, _isolated_resources):
    # Explicitly isolate every imported store in addition to conftest's config.
    root = tmp_path / 'resources_json'
    monkeypatch.setattr(save_manager, 'SAVE_PATH', root / 'save.json')
    monkeypatch.setattr(email_loader, 'EMAILS_PATH', root / 'emails.json')
    monkeypatch.setattr(case_loader, 'CASES_DIR', root / 'cases')
    monkeypatch.setattr(npc_loader, 'NPC_PROFILES_DIR', root / 'npc_profiles')
    monkeypatch.setattr('services.chat_notifications.broadcaster.publish', lambda event: None)
    assert save_manager.SAVE_PATH.is_relative_to(tmp_path)
    assert case_loader.CASES_DIR.is_relative_to(tmp_path)
    assert npc_loader.NPC_PROFILES_DIR.is_relative_to(tmp_path)
    assert email_loader.EMAILS_PATH.is_relative_to(tmp_path)

def scripts():
    bosses = [ChatScript.model_validate(s) for s in json.loads((ROOT / 'boss_calls.json').read_text())]
    npcs = [ChatScript.model_validate_json(p.read_text()) for p in (ROOT / 'npc_chats').glob('*.json')]
    return bosses, npcs

def test_document_dialogue_branches_are_complete():
    bosses, npcs = scripts()
    opening = next(s for s in bosses if s.script_id == 'boss_gaoqiu_onboarding_01')
    lvshi = next(s for s in npcs if s.script_id == 'npc_lvshi_interview_01')
    for script in [opening, lvshi]:
        visited = set()
        def walk(id, route):
            assert id not in route
            visited.add(id)
            for option in script.nodes[id].options:
                assert option.next_node_id in script.nodes
                walk(option.next_node_id, route | {id})
        walk(script.start_node_id, set())
        assert visited == set(script.nodes)
    assert '2104' in opening.nodes['cold'].text
    assert '2100' in opening.nodes['eager'].text
    assert all('吕师' in opening.nodes[id].text for id in ('aware', 'unaware'))
    assert '白金重工' in lvshi.nodes['password'].text
    assert not lvshi.nodes['end'].options

def test_story_npc_is_fixed_and_not_randomly_assigned():
    _, pool = scripts()
    result = DailyQueueBuilder().build(_schedule(), 1, pool)
    assert result.npc_profiles[0].npc_name == '吕师'
    assert result.npc_profiles[0].employee_id == 'NET-0311'
    assert result.cases[0].chat_script_id == 'npc_lvshi_interview_01'
    assert all(c.chat_script_id != 'npc_lvshi_interview_01' for c in result.cases[1:])
    assert ScriptMatcher().pick(result.npc_profiles[0], pool, random.Random(2)) != 'npc_lvshi_interview_01'

def test_upgrade_is_idempotent_and_preserves_progress():
    _, pool = scripts()
    DailyQueueBuilder().build(_schedule(), 1, pool)
    save_manager.write(PlayerSave(current_day=1, latest_boss_script_id='boss_call_checkin_01', case_verdicts={'case_1_1':'approved'}))
    ensure_story()
    first = save_manager.read()
    ensure_story()
    assert save_manager.read() == first
    assert first.latest_boss_script_id == 'boss_gaoqiu_onboarding_01'
    assert first.case_verdicts == {'case_1_1':'approved'}
    assert len(email_loader.load_all()) == 2
    assert email_loader.load_all()[1].attachments[0].filename == '吕师_基本档案.ssf'
