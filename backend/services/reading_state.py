"""Read receipts follow displayed content, independently of gameplay progress."""
from data import case_loader, email_loader, npc_loader, queue_store, script_loader
from models.save import PlayerSave
from services import chat_sessions

CHANNELS = ("email", "archive", "medical", "chat")


def snapshot(save: PlayerSave) -> dict:
    result = {channel: {} for channel in CHANNELS}

    def add(channel, item_id, version="1", **metadata):
        result[channel][item_id] = {
            "version": version,
            "is_read": save.read_receipts.get(channel, {}).get(item_id) == version,
            **metadata,
        }

    for email in email_loader.load_all():
        if email.day <= save.current_day:
            add("email", email.email_id)

    cases = {case.case_id: case for case in case_loader.load_all() if case.resume.downloaded or case.case_id in (save.friend_case_ids or [])}
    for case in cases.values():
        if save.archive_case_ids is None or case.case_id in save.archive_case_ids:
            add("archive", case.case_id, str(1 + len(save.archive_evidence.get(case.case_id, []))))
        try:
            npc_loader.load(case.npc_id)
        except FileNotFoundError:
            continue
        if case.resume.downloaded:
            add("medical", case.npc_id)

    scripts = {s.script_id: s for s in script_loader.load_all_boss_scripts() + script_loader.load_all_npc_scripts()}

    def add_chat(contact_id, script_id):
        script = scripts.get(script_id)
        if script is None:
            return
        node_id = chat_sessions.node_id(save, contact_id, script)
        # Candidate conversations persist across days; advancing the day does
        # not create a new message. Boss calls are day/revision scoped because
        # each incoming call is a distinct conversation.
        if contact_id == "boss":
            version = f"{save.current_day}:{script_id}:{node_id}:{save.chat_call_revision}"
        else:
            version = f"{script_id}:{node_id}"
        message_count = len(chat_sessions.snapshot(save, contact_id, script).messages)
        if message_count > 1:
            version += f":messages={message_count}"
        add("chat", contact_id, version, script_id=script_id, node_id=node_id)
        if contact_id != "boss":
            # Older receipts included the day and a zero call revision.
            # Accept the same content from any day without modifying the save.
            receipt = save.read_receipts.get("chat", {}).get(contact_id, "")
            day, separator, content = receipt.partition(":")
            if separator and day.isdigit() and content == f"{version}:0":
                result["chat"][contact_id]["is_read"] = True

    boss_scripts = script_loader.load_all_boss_scripts()
    if boss_scripts:
        add_chat("boss", save.latest_boss_script_id or boss_scripts[0].script_id)
    # Chat receipts follow all downloaded candidates, including prior days.
    # Using only today's queue caused read conversations to vanish from the
    # read/unread filters after advancing the day.
    for case in cases.values():
        if save.friend_case_ids is None or case.case_id in save.friend_case_ids:
            add_chat(case.case_id, case.chat_script_id)
    return result
