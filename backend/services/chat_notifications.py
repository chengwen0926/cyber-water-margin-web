from core.events import broadcaster
from data import save_manager


def publish_call(script_id: str) -> None:
    # Save the new version first: reconnecting clients can recover unread calls.
    def mutate(save):
        save.chat_call_revision += 1
        save.latest_boss_script_id = script_id

    save_manager.update(mutate)
    broadcaster.publish({"event": "incoming_call", "script_id": script_id})
