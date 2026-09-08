from pathlib import Path
import json

import pytest

from api import chat
from data import save_manager, script_loader, queue_store
from models.chat import ChatScript
from models.save import PlayerSave
from services.chat_notifications import publish_call


@pytest.fixture
def boss_calls(monkeypatch):
    import core.config as config
    monkeypatch.setattr(save_manager, 'SAVE_PATH', config.SAVE_PATH)
    monkeypatch.setattr(queue_store, 'QUEUES_DIR', config.RESOURCES_DIR / 'queues')
    scripts = [ChatScript.model_validate(s) for s in json.loads(
        (Path(__file__).parents[1] / 'resources/json/scripts/boss_calls.json').read_text())]
    monkeypatch.setattr(script_loader, 'load_all_boss_scripts', lambda: scripts)
    monkeypatch.setattr(script_loader, 'load_all_npc_scripts', lambda: [])
    monkeypatch.setattr('services.chat_notifications.broadcaster.publish', lambda event: None)
    save_manager.write(PlayerSave(current_day=1))
    return scripts


def test_second_boss_call_starts_again_and_retains_history(boss_calls):
    script = boss_calls[0]
    publish_call(script.script_id)
    first = chat.get_session('boss', script.script_id)
    option = first.current_node.options[0]
    finished = chat.advance_session('boss', chat.SessionAdvanceRequest(
        script_id=script.script_id, option_id=option.option_id, expected_node_id=first.current_node.node_id))
    assert not finished.current_node.options
    save_manager.update(lambda save: setattr(save, 'current_day', 2))
    publish_call(script.script_id)
    second = chat.get_session('boss', script.script_id)
    assert second.current_node.node_id == script.start_node_id
    assert second.current_node.options
    assert second.messages[:len(finished.messages)] == finished.messages
    assert second.messages[-1].text == script.nodes[script.start_node_id].text
    assert len(second.messages) == len(finished.messages) + 1
