import pytest
from fastapi import HTTPException
from api import workspace, archive, chat, day, reading
from data import save_manager, email_loader, script_loader
from models.save import PlayerSave
from services.daily_queue_builder import DailyQueueBuilder
from tests.test_daily_queue_builder import _schedule, _script_pool

@pytest.fixture
def materials(monkeypatch):
    import core.config as config
    monkeypatch.setattr(save_manager, 'SAVE_PATH', config.SAVE_PATH)
    monkeypatch.setattr(email_loader, 'EMAILS_PATH', config.EMAILS_PATH)
    save_manager.write(PlayerSave(current_day=1))
    pool = _script_pool()
    monkeypatch.setattr(script_loader, 'load_all_npc_scripts', lambda: pool)
    monkeypatch.setattr(script_loader, 'load_all_boss_scripts', lambda: [])
    result = DailyQueueBuilder().build(_schedule(), seed=1, script_pool=pool)
    email_loader.append(day._daily_email(1, _schedule(), result.cases))
    workspace.state()
    return result.cases


def test_preview_and_copy_do_not_create_archive_or_friend(materials):
    source = workspace.Source(kind='resume', id=materials[0].case_id)
    doc = workspace.preview(source)
    assert doc['contact'].endswith('@localnet')
    assert all(set(f) == {'key', 'label', 'value'} for f in doc['fields'])
    workspace.items(workspace.ItemRequest(action='copy', source=source))
    assert len(workspace.state()['items']) == 1
    assert archive.list_archive() == []
    assert chat.list_contacts() == []


def test_folder_cycle_and_trash_restore(materials):
    result = workspace.items(workspace.ItemRequest(action='folder', name='审查'))
    folder = result['items'][0]['id']
    result = workspace.items(workspace.ItemRequest(action='folder', name='材料', parent_id=folder))
    child = result['items'][1]['id']
    with pytest.raises(HTTPException):
        workspace.items(workspace.ItemRequest(action='move', item_id=folder, parent_id=child))
    workspace.items(workspace.ItemRequest(action='delete', item_id=folder))
    result = workspace.items(workspace.ItemRequest(action='restore', item_id=folder))
    assert result['items'][0]['deleted'] is False
    assert result['items'][1]['parent_id'] == folder


def test_import_and_verification_are_idempotent(materials):
    case = materials[0]
    resume = workspace.Source(kind='resume', id=case.case_id)
    first = workspace.import_document(workspace.ImportRequest(source=resume))
    assert first['unknown'] == len(case.resume.fields)
    again = workspace.import_document(workspace.ImportRequest(source=resume))
    assert len(again['evidence']) == 1
    verified = workspace.import_document(workspace.ImportRequest(source=workspace.Source(kind='medical', id=case.case_id), case_id=case.case_id))
    assert verified['unknown'] == 0
    assert verified['conflicts'] == sum(p['declared'] != p['verified'] for p in verified['points'])
    assert archive.list_archive()[0].case_id == case.case_id
    assert chat.list_contacts() == []
    assert save_manager.read().archive_evidence[case.case_id]


def test_unrelated_material_does_not_clear_risk(materials):
    case = materials[0]
    workspace.import_document(workspace.ImportRequest(source=workspace.Source(kind='resume', id=case.case_id)))
    with pytest.raises(HTTPException) as error:
        workspace.import_document(workspace.ImportRequest(source=workspace.Source(kind='medical', id=materials[1].case_id), case_id=case.case_id))
    assert error.value.status_code == 400
    assert len(workspace.assessment(case.case_id)['evidence']) == 1
    result = workspace.import_document(workspace.ImportRequest(source=workspace.Source(kind='history', id='event-audit'), case_id=case.case_id))
    assert result['unknown'] == len(case.resume.fields)


def test_friend_before_archiving_has_readable_chat(materials):
    case = materials[0]
    doc = workspace.document(workspace.Source(kind='resume', id=case.case_id))
    workspace.add_friend(workspace.FriendRequest(contact=doc['contact']))
    workspace.add_friend(workspace.FriendRequest(contact=doc['contact']))
    assert [c.id for c in chat.list_contacts()] == [case.case_id]
    assert case.case_id in reading.get_reading_state()['chat']
    assert archive.list_archive() == []
    assert chat.get_session(case.case_id, case.chat_script_id).contact_id == case.case_id


def test_settings_persist(materials):
    workspace.settings(workspace.Settings(brightness=60, icon_size=80, motion=False))
    assert workspace.state()['settings'] == {'brightness':60, 'icon_size':80, 'motion':False}
