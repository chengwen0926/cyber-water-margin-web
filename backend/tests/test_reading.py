from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from api.reading import ReadRequest, get_reading_state, mark_read
from data import save_manager
from models.chat import ChatScript, DialogueNode
from models.save import PlayerSave
from services import reading_state
from services.chat_notifications import publish_call


@pytest.fixture
def reading_data(monkeypatch):
    import core.config as config
    monkeypatch.setattr(save_manager, 'SAVE_PATH', config.SAVE_PATH)
    save_manager.write(PlayerSave(current_day=1))
    monkeypatch.setattr(reading_state.email_loader, 'load_all', lambda: [
        SimpleNamespace(email_id='email_1', day=1), SimpleNamespace(email_id='future', day=2)])
    monkeypatch.setattr(reading_state.case_loader, 'load_all', lambda: [
        SimpleNamespace(case_id=id, npc_id='npc_' + id, resume=SimpleNamespace(downloaded=True), chat_script_id='shared')
        for id in ['case_a', 'case_b']])
    monkeypatch.setattr(reading_state.npc_loader, 'load', lambda id: SimpleNamespace(npc_id=id))
    monkeypatch.setattr(reading_state.queue_store, 'load', lambda day: SimpleNamespace(entries=[
        SimpleNamespace(case_id='case_a'), SimpleNamespace(case_id='case_b')]))
    scripts = [ChatScript(script_id=id, participant=kind, start_node_id='start', nodes={
        'start': DialogueNode(node_id='start', speaker=kind, text='你好'),
        'next': DialogueNode(node_id='next', speaker=kind, text='新消息'),
    }) for id, kind in [('boss_script', 'boss'), ('shared', 'npc')]]
    monkeypatch.setattr(reading_state.script_loader, 'load_all_boss_scripts', lambda: scripts[:1])
    monkeypatch.setattr(reading_state.script_loader, 'load_all_npc_scripts', lambda: scripts[1:])


def acknowledge(channel, id):
    version = get_reading_state()[channel][id]['version']
    mark_read(ReadRequest(channel=channel, item_id=id, version=version))
    return version


def test_old_save_and_independent_receipts(reading_data):
    assert PlayerSave.model_validate({'current_day': 1}).read_receipts == {}
    assert 'future' not in get_reading_state()['email']
    acknowledge('email', 'email_1')
    acknowledge('archive', 'case_a')
    acknowledge('archive', 'case_a')
    assert get_reading_state()['email']['email_1']['is_read']
    assert get_reading_state()['archive']['case_a']['is_read']
    assert not get_reading_state()['medical']['npc_case_a']['is_read']
    assert not get_reading_state()['archive']['case_b']['is_read']
    restored = PlayerSave.model_validate_json(save_manager.read().model_dump_json())
    assert restored.read_receipts['archive'] == {'case_a': '1'}


def test_shared_chat_template_does_not_share_receipts(reading_data):
    old_version = acknowledge('chat', 'case_a')
    assert not get_reading_state()['chat']['case_b']['is_read']
    save_manager.update(lambda save: save.chat_progress.update({'shared': 'next'}))
    assert not get_reading_state()['chat']['case_a']['is_read']
    with pytest.raises(HTTPException) as error:
        mark_read(ReadRequest(channel='chat', item_id='case_a', version=old_version))
    assert error.value.status_code == 409
    acknowledge('chat', 'case_a')
    assert get_reading_state()['chat']['case_a']['is_read']


def test_new_call_and_day_become_unread(reading_data, monkeypatch):
    monkeypatch.setattr('services.chat_notifications.broadcaster.publish', lambda event: None)
    acknowledge('chat', 'boss')
    publish_call('boss_script')
    assert not get_reading_state()['chat']['boss']['is_read']
    acknowledge('chat', 'boss')
    save_manager.update(lambda save: setattr(save, 'current_day', 2))
    assert not get_reading_state()['chat']['boss']['is_read']
    assert save_manager.read().latest_boss_script_id == 'boss_script'


def test_unknown_content_is_not_marked(reading_data):
    with pytest.raises(HTTPException) as error:
        mark_read(ReadRequest(channel='email', item_id='future', version='1'))
    assert error.value.status_code == 404
    assert save_manager.read().read_receipts == {}
