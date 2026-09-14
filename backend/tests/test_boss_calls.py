from pathlib import Path
import json

import pytest

from api import chat
from data import save_manager, script_loader, queue_store
from models.chat import ChatScript
from models.save import PlayerSave
from services.chat_notifications import publish_call


@pytest.fixture
def boss_calls(monkeypatch):
    import core.config as config
    monkeypatch.setattr(save_manager, 'SAVE_PATH', config.SAVE_PATH)
    monkeypatch.setattr(queue_store, 'QUEUES_DIR', config.RESOURCES_DIR / 'queues')
    scripts = [ChatScript.model_validate(s) for s in json.loads(
        (Path(__file__).parents[1] / 'resources/json/scripts/boss_calls.json').read_text())]
    monkeypatch.setattr(script_loader, 'load_all_boss_scripts', lambda: scripts)
    monkeypatch.setattr(script_loader, 'load_all_npc_scripts', lambda: [])
    monkeypatch.setattr('services.chat_notifications.broadcaster.publish', lambda event: None)
    save_manager.write(PlayerSave(current_day=1))
    return scripts


def test_second_boss_call_starts_again_and_retains_history(boss_calls):
    script = boss_calls[0]
    publish_call(script.script_id)
    first = chat.get_session('boss', script.script_id)
    option = first.current_node.options[0]
    finished = chat.advance_session('boss', chat.SessionAdvanceRequest(
        script_id=script.script_id, option_id=option.option_id, expected_node_id=first.current_node.node_id))
    assert not finished.current_node.options
    save_manager.update(lambda save: setattr(save, 'current_day', 2))
    publish_call(script.script_id)
    second = chat.get_session('boss', script.script_id)
    assert second.current_node.node_id == script.start_node_id
    assert second.current_node.options
    assert second.messages[:len(finished.messages)] == finished.messages
    assert second.messages[-1].text == script.nodes[script.start_node_id].text
    assert len(second.messages) == len(finished.messages) + 1


def test_new_call_does_not_resume_legacy_terminal_node(boss_calls):
    script = boss_calls[0]
    save_manager.write(PlayerSave(current_day=1,
        chat_progress={script.script_id: 'end'},
        conversation_progress={json.dumps(['boss', script.script_id], separators=(',', ':')): 'end'}))
    publish_call(script.script_id)
    session = chat.get_session('boss', script.script_id)
    assert session.current_node.node_id == script.start_node_id
    assert session.current_node.options


def test_three_calls_do_not_duplicate_cumulative_history(boss_calls):
    script = boss_calls[0]
    previous_messages = []
    for _ in range(3):
        publish_call(script.script_id)
        session = chat.get_session('boss', script.script_id)
        assert session.messages[:-1] == previous_messages
        assert len(session.messages) == len(previous_messages) + 1
        option = session.current_node.options[0]
        finished = chat.advance_session('boss', chat.SessionAdvanceRequest(
            script_id=script.script_id, option_id=option.option_id,
            expected_node_id=session.current_node.node_id))
        previous_messages = finished.messages
    assert len(previous_messages) == 9


def test_pending_video_call_survives_reload_and_acknowledgement(boss_calls):
    from services.chat_notifications import pending_call
    from api.events import acknowledge_call, CallAcknowledgement
    publish_call(boss_calls[0].script_id)
    invitation = pending_call()
    assert invitation['contact_id'] == 'boss'
    assert invitation['revision'] == 1
    assert pending_call() == invitation
    acknowledge_call(CallAcknowledgement(revision=1))
    assert pending_call() is None
    publish_call(boss_calls[0].script_id)
    acknowledge_call(CallAcknowledgement(revision=1))
    assert pending_call()['revision'] == 2


def test_video_text_messages_persist_without_triggering_plot(boss_calls):
    from fastapi import HTTPException
    from services import reading_state
    publish_call(boss_calls[0].script_id)
    session = chat.get_session('boss', boss_calls[0].script_id)
    version = reading_state.snapshot(save_manager.read())['chat']['boss']['version']
    request = chat.SessionMessageRequest(script_id=session.script_id, text='您好，请再说明一下要求', expected_node_id=session.current_node.node_id, expected_message_count=len(session.messages))
    result = chat.send_message('boss', request)
    assert result.messages[-2].text == request.text
    assert result.messages[-1].speaker == 'boss'
    assert result.current_node.node_id == session.current_node.node_id
    assert chat.get_session('boss', session.script_id).messages == result.messages
    assert reading_state.snapshot(save_manager.read())['chat']['boss']['version'] != version
    with pytest.raises(HTTPException) as conflict:
        chat.send_message('boss', request)
    assert conflict.value.status_code == 409
    assert not save_manager.read().active_directives
    option = session.current_node.options[0]
    advanced = chat.send_message('boss', chat.SessionMessageRequest(script_id=session.script_id, text=option.text, expected_node_id=session.current_node.node_id, expected_message_count=len(result.messages)))
    assert advanced.current_node.node_id == option.next_node_id
    after = chat.send_message('boss', chat.SessionMessageRequest(script_id=session.script_id, text='谢谢', expected_node_id=advanced.current_node.node_id, expected_message_count=len(advanced.messages)))
    assert after.messages[-2].text == '谢谢'
