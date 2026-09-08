import pytest
from fastapi import HTTPException

from api import chat
from data import save_manager
from models.chat import ChatScript, DialogueNode, DialogueOption
from models.save import PlayerSave
from services import chat_sessions


@pytest.fixture
def conversation(monkeypatch):
    import core.config as config
    monkeypatch.setattr(save_manager, 'SAVE_PATH', config.SAVE_PATH)
    save_manager.write(PlayerSave(current_day=1))
    script = ChatScript(script_id='shared', participant='npc', start_node_id='start', nodes={
        'start': DialogueNode(node_id='start', speaker='npc', text='您好', options=[
            DialogueOption(option_id='health', text='身体怎么样？', next_node_id='health')]),
        'health': DialogueNode(node_id='health', speaker='npc', text='体检合格', options=[
            DialogueOption(option_id='bye', text='谢谢', next_node_id='end')]),
        'end': DialogueNode(node_id='end', speaker='npc', text='再见', reveals_clue='clue_test'),
    })
    monkeypatch.setattr(chat, '_contact_script', lambda contact, script_id: script)
    return script


def reply(contact='case_a', option='health', node='start'):
    return chat.advance_session(contact, chat.SessionAdvanceRequest(
        script_id='shared', option_id=option, expected_node_id=node))


def test_transcript_restored_and_contacts_independent(conversation):
    result = reply()
    assert [(message.speaker, message.text) for message in result.messages] == [
        ('npc', '您好'), ('player', '身体怎么样？'), ('npc', '体检合格')]
    assert chat.get_session('case_a', 'shared') == result
    other = chat.get_session('case_b', 'shared')
    assert other.current_node.node_id == 'start'
    assert len(other.messages) == 1
    assert save_manager.read().chat_progress == {}
    assert chat_sessions.node_id(save_manager.read(), 'case_a', conversation) == 'health'


def test_duplicate_and_invalid_reply_do_not_change_history(conversation):
    result = reply()
    with pytest.raises(HTTPException) as stale:
        reply()
    assert stale.value.status_code == 409
    with pytest.raises(HTTPException) as invalid:
        reply(option='missing', node='health')
    assert invalid.value.status_code == 400
    assert chat.get_session('case_a', 'shared') == result


def test_terminal_reply_keeps_history_and_unlocks_clue(conversation):
    reply()
    result = reply(option='bye', node='health')
    assert [m.text for m in result.messages] == ['您好', '身体怎么样？', '体检合格', '谢谢', '再见']
    assert result.current_node.options == []
    assert save_manager.read().discovered_clues == ['clue_test']


def test_old_save_does_not_invent_past_choices(conversation):
    save_manager.write(PlayerSave(chat_progress={'shared': 'health'}))
    session = chat.get_session('case_a', 'shared')
    assert [m.text for m in session.messages] == ['体检合格']
    result = reply(option='bye', node='health')
    assert [m.text for m in result.messages] == ['体检合格', '谢谢', '再见']
