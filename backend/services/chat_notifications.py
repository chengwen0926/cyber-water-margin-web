from core.events import broadcaster
from data import save_manager


def publish_call(script_id: str) -> None:
    # Save the new version first: reconnecting clients can recover unread calls.
    def mutate(save):
        save.chat_call_revision += 1
        save.latest_boss_script_id = script_id

    save = save_manager.update(mutate)
    broadcaster.publish(call_event(save))


def call_event(save):
    return {"event": "incoming_call", "script_id": save.latest_boss_script_id,
            "revision": save.chat_call_revision, "contact_id": "boss", "caller_name": "高俅"}


def pending_call():
    save = save_manager.read()
    if save.latest_boss_script_id and save.chat_call_revision > save.handled_call_revision:
        return call_event(save)
    return None
