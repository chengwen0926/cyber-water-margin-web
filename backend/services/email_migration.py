"""Combine the former schedule/resume pair without losing attachments or receipts."""
import json

import portalocker

from data import email_loader, save_manager
from models.email import Email


def migrate_daily_emails() -> int:
    merged_count = 0

    def mutate(save):
        nonlocal merged_count
        # Match save→email lock order; only generated daily mail IDs are migrated.
        with portalocker.Lock(str(email_loader.EMAILS_PATH), 'r+', timeout=5) as file:
            emails = [Email.model_validate(item) for item in json.load(file)]
            groups: dict[int, list[Email]] = {}
            for email in emails:
                if email.email_id in {f'email_schedule_{email.day}', f'email_resumes_{email.day}', f'email_daily_{email.day}'}:
                    groups.setdefault(email.day, []).append(email)
            replacements = {}
            removed = set()
            receipts = save.read_receipts.get('email', {})
            for day, group in groups.items():
                if not any(e.email_id != f'email_daily_{day}' for e in group):
                    continue
                ordered = sorted(group, key=lambda e: (not e.email_id.startswith('email_schedule_'), e.email_id))
                attachments = {a.attachment_id: a for e in ordered for a in e.attachments}
                merged = Email(
                    email_id=f'email_daily_{day}', day=day, sender='人事系统',
                    subject=f'第{day}天工作安排与候选人简历',
                    body='\n\n'.join(dict.fromkeys(e.body for e in ordered if e.body)),
                    attachments=list(attachments.values()),
                )
                replacements[group[0].email_id] = merged
                removed.update(e.email_id for e in group[1:])
                was_read = all(receipts.get(e.email_id) == '1' for e in group)
                for email in group:
                    receipts.pop(email.email_id, None)
                if was_read:
                    receipts[merged.email_id] = '1'
                if any(e.email_id in save.unlocked_emails for e in group):
                    old_ids = {e.email_id for e in group}
                    save.unlocked_emails = [id for id in save.unlocked_emails if id not in old_ids]
                    save.unlocked_emails.append(merged.email_id)
                merged_count += 1
            if merged_count:
                save.read_receipts['email'] = receipts
                result = [replacements.get(e.email_id, e) for e in emails if e.email_id not in removed]
                file.seek(0)
                file.write(json.dumps([e.model_dump() for e in result], ensure_ascii=False, indent=2))
                file.truncate()

    save_manager.update(mutate)
    return merged_count
