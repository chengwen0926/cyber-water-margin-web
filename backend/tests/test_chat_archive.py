import pytest

from api import chat, reading
from data import case_loader, queue_store, save_manager, script_loader
from models.chat import ChatMessage
from models.save import PlayerSave
from services.daily_queue_builder import DailyQueueBuilder
from services import chat_sessions
from tests.test_daily_queue_builder import _schedule, _script_pool


@pytest.fixture
def archived_chat(monkeypatch):
    import core.config as config
    monkeypatch.setattr(save_manager, 'SAVE_PATH', config.SAVE_PATH)
    monkeypatch.setattr(queue_store, 'QUEUES_DIR', config.RESOURCES_DIR / 'queues')
    monkeypatch.setattr('data.email_loader.EMAILS_PATH', config.EMAILS_PATH)
    save_manager.write(PlayerSave(current_day=1))
    pool = _script_pool()
    monkeypatch.setattr(script_loader, 'load_all_npc_scripts', lambda: pool)
    monkeypatch.setattr(script_loader, 'load_all_boss_scripts', lambda: [])
    result = DailyQueueBuilder().build(_schedule(), seed=1, script_pool=pool)
    queue_store.save(result.queue)
    case = result.cases[0]
    case.resume.downloaded = True
    case_loader.save(case)
    return case


def test_read_chat_stays_available_after_next_day(archived_chat):
    case = archived_chat
    state = reading.get_reading_state()['chat'][case.case_id]
    reading.mark_read(reading.ReadRequest(channel='chat', item_id=case.case_id, version=state['version']))
    save_manager.update(lambda save: setattr(save, 'current_day', 2))
    assert case.case_id in {c.id for c in chat.list_contacts()}
    restored = reading.get_reading_state()['chat'][case.case_id]
    assert restored['is_read'] is True
    assert restored['version'] == state['version']
    assert chat.get_session(case.case_id, case.chat_script_id).contact_id == case.case_id


def test_legacy_transcript_is_not_replaced_with_last_message(archived_chat):
    case = archived_chat
    messages = [ChatMessage(speaker='npc', text='您好'), ChatMessage(speaker='player', text='我的回复'), ChatMessage(speaker='npc', text='最后一条')]
    key = chat_sessions.legacy_session_key(case.case_id, case.chat_script_id)
    save_manager.update(lambda save: save.chat_transcripts.update({key: messages}))
    assert chat.get_session(case.case_id, case.chat_script_id).messages == messages


def test_legacy_receipt_preserves_read_content_across_days(archived_chat):
    case = archived_chat
    state = reading.get_reading_state()['chat'][case.case_id]
    legacy = f"1:{state['script_id']}:{state['node_id']}:0"
    save_manager.update(lambda save: save.read_receipts.update({'chat': {case.case_id: legacy}}))
    save_manager.update(lambda save: setattr(save, 'current_day', 4))
    assert reading.get_reading_state()['chat'][case.case_id]['is_read'] is True
    # An old receipt for different content must not acknowledge the current node.
    save_manager.update(lambda save: save.read_receipts['chat'].update({case.case_id: f'1:{case.chat_script_id}:other_node:0'}))
    assert reading.get_reading_state()['chat'][case.case_id]['is_read'] is False
