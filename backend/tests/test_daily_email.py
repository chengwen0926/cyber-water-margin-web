import json

import pytest

from api import day, email as email_api
from data import email_loader, queue_store, save_manager
from models.email import Email, EmailAttachment
from models.save import PlayerSave
from services.email_migration import migrate_daily_emails
from tests.test_daily_queue_builder import _schedule, _script_pool


@pytest.fixture
def mail_storage(monkeypatch):
    import core.config as config
    monkeypatch.setattr(save_manager, 'SAVE_PATH', config.SAVE_PATH)
    monkeypatch.setattr(email_loader, 'EMAILS_PATH', config.EMAILS_PATH)
    monkeypatch.setattr(queue_store, 'QUEUES_DIR', config.RESOURCES_DIR / 'queues')
    config.ensure_save_exists()


def test_advance_sends_one_complete_mail(mail_storage, monkeypatch):
    schedule = _schedule()
    monkeypatch.setattr(day.schedule_loader, 'load', lambda number: schedule)
    monkeypatch.setattr(day.script_loader, 'load_all_npc_scripts', _script_pool)
    monkeypatch.setattr(day.script_loader, 'load_all_boss_scripts', lambda: [])
    result = day.advance_day()
    emails = email_loader.load_all()
    assert len(emails) == 1
    assert emails[0].email_id == 'email_daily_1'
    assert '今日审查规则' in emails[0].body
    assert schedule.review_rules[0].description in emails[0].body
    assert '请双击查看原件，或拖入档案系统建立档案' in emails[0].body
    assert [a.case_id for a in emails[0].attachments] == [c.case_id for c in result.cases]


@pytest.mark.parametrize('both_read', [True, False])
def test_migration_keeps_materials_progress_and_read_status(mail_storage, both_read):
    attachment = EmailAttachment(attachment_id='attachment_case_1_0', case_id='case_1_0', filename='resume.pdf')
    emails = [
        Email(email_id='email_schedule_1', day=1, sender='人事系统', subject='安排', body='今日规则'),
        Email(email_id='email_resumes_1', day=1, sender='招聘平台', subject='简历', body='请下载附件', attachments=[attachment]),
        Email(email_id='special_notice', day=1, sender='领导', subject='通知', body='特别通知'),
    ]
    email_loader.EMAILS_PATH.write_text(json.dumps([e.model_dump() for e in emails]), encoding='utf-8')
    receipts = {'email_schedule_1': '1'}
    if both_read:
        receipts['email_resumes_1'] = '1'
    save_manager.write(PlayerSave(current_day=1, read_receipts={'email': receipts},
                                  downloaded_attachments=[attachment.attachment_id],
                                  case_verdicts={'case_1_0': 'approved'}))
    assert migrate_daily_emails() == 1
    result = email_loader.load_all()
    assert [e.email_id for e in result] == ['email_daily_1', 'special_notice']
    assert result[0].attachments == [attachment]
    assert result[0].body == '今日规则\n\n请下载附件'
    assert email_api.get_email('email_resumes_1') == result[0]
    save = save_manager.read()
    assert (save.read_receipts['email'].get('email_daily_1') == '1') == both_read
    assert save.downloaded_attachments == [attachment.attachment_id]
    assert save.case_verdicts == {'case_1_0': 'approved'}
    assert migrate_daily_emails() == 0
    assert email_loader.load_all() == result
