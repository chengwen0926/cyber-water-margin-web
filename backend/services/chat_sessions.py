"""Conversation progress and transcript keyed by contact and script."""
import json

from models.chat import ChatMessage, ChatScript, ChatSession
from models.save import PlayerSave


def session_key(contact_id: str, script_id: str, call_revision: int = 0) -> str:
    return json.dumps([contact_id, script_id, call_revision], separators=(',', ':'))

def legacy_session_key(contact_id: str, script_id: str) -> str:
    return json.dumps([contact_id, script_id], separators=(',', ':'))


def node_id(save: PlayerSave, contact_id: str, script: ChatScript) -> str:
    revision = save.chat_call_revision if contact_id == "boss" else 0
    key = session_key(contact_id, script.script_id, revision)
    return save.conversation_progress.get(key, save.conversation_progress.get(legacy_session_key(contact_id, script.script_id), save.chat_progress.get(script.script_id, script.start_node_id)))


def snapshot(save: PlayerSave, contact_id: str, script: ChatScript) -> ChatSession:
    revision = save.chat_call_revision if contact_id == "boss" else 0
    key = session_key(contact_id, script.script_id, revision)
    node = script.nodes[node_id(save, contact_id, script)]
    # Old saves contain no chosen replies. Show the saved node without inventing history.
    messages = save.chat_transcripts.get(key)
    if messages is None and contact_id != "boss":
        # Candidate conversations written by older versions used a two-part
        # key. Preserve those transcripts when reading newer saves.
        messages = save.chat_transcripts.get(legacy_session_key(contact_id, script.script_id))
    if messages is None and contact_id == "boss":
        previous = [message for old_key, items in save.chat_transcripts.items()
                    if old_key.startswith('["boss",') for message in items]
        messages = [*previous, ChatMessage(speaker=node.speaker, text=node.text)]
    if not messages:
        messages = [ChatMessage(speaker=node.speaker, text=node.text)]
    return ChatSession(contact_id=contact_id, script_id=script.script_id, current_node=node, messages=messages)
