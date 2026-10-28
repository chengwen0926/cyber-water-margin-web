"""Opening performance travels with dialogue, including pre-performance saves."""
import json
from pathlib import Path

import pytest

from api import chat
from data import save_manager
from models.chat import ChatMessage, ChatScript
from models.save import PlayerSave
from services import chat_sessions


@pytest.fixture
def opening(monkeypatch):
    import core.config as config
    path = Path(__file__).parents[1] / 'resources/json/scripts/boss_calls.json'
    raw = next(s for s in json.loads(path.read_text()) if s['script_id'] == 'boss_gaoqiu_onboarding_01')
    script = ChatScript.model_validate(raw)
    monkeypatch.setattr(save_manager, 'SAVE_PATH', config.SAVE_PATH)
    monkeypatch.setattr(chat, '_contact_script', lambda contact, script_id: script)
    save_manager.write(PlayerSave(current_day=1))
    return script


@pytest.mark.parametrize('mood', ['calm', 'eager'])
@pytest.mark.parametrize('sports', ['listen', 'skip'])
@pytest.mark.parametrize('news', ['aware', 'unaware'])
def test_one_click_branches_deliver_complete_performance(opening, mood, sports, news):
    session = chat.get_session('boss', opening.script_id)
    assert session.messages[-1].beats[0].expression == 'smile'
    for option in (mood, sports, news):
        previous_count = len(session.messages)
        session = chat.advance_session('boss', chat.SessionAdvanceRequest(
            script_id=opening.script_id, option_id=option,
            expected_node_id=session.current_node.node_id))
        assert len(session.messages) == previous_count + 2
        assert session.messages[-2].speaker == 'player'
        assert session.messages[-1].beats == session.current_node.beats
        assert ''.join(b.text for b in session.messages[-1].beats) == session.messages[-1].text
    assert not session.current_node.options
    assert session.messages[-1].beats[0].expression == ('angry' if news == 'aware' else 'gaze')
    assert session.messages[-1].beats[-1].expression == 'grasp'
    assert chat.get_session('boss', opening.script_id) == session


def test_old_transcript_gets_cues_without_modifying_save(opening):
    node = opening.nodes['aware']
    key = chat_sessions.session_key('boss', opening.script_id)
    old = PlayerSave(conversation_progress={key: node.node_id}, chat_transcripts={key: [ChatMessage(speaker='boss', text=node.text)]})
    save_manager.write(old)
    result = chat.get_session('boss', opening.script_id)
    assert result.messages[-1].beats == node.beats
    assert save_manager.read() == old


def test_free_text_never_replays_authored_performance(opening):
    result = chat.send_message('boss', chat.SessionMessageRequest(
        script_id=opening.script_id, text='收到', expected_node_id='start', expected_message_count=1))
    assert result.current_node.node_id == 'start'
    assert result.messages[-1].beats == []


def test_all_six_expressions_and_emphasis_are_authored(opening):
    beats = [beat for node in opening.nodes.values() for beat in node.beats]
    assert {b.expression for b in beats} == {'smile', 'recollect', 'animated', 'gaze', 'grasp', 'angry'}
    assert {word for b in beats for word in b.emphasis} == {'恐怖袭击', '我', '光明社', '宋王星集团', '吕师', '邮箱'}
    for b in beats:
        assert all(word in b.text for word in b.emphasis)
    assert opening.nodes['start'].beats[0].pause_after_ms == 650
    assert opening.nodes['lesson'].beats[0].char_ms < opening.nodes['cold'].beats[0].char_ms
    assert opening.nodes['lesson'].beats[-1].expression == 'smile'
