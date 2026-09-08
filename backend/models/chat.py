from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class DialogueOption(BaseModel):
    option_id: str
    text: str
    next_node_id: str


class DialogueNode(BaseModel):
    node_id: str
    speaker: Literal["boss", "npc", "player"]
    text: str
    options: list[DialogueOption] = []
    reveals_clue: str | None = None
    reveals_directive: str | None = None


class ChatScript(BaseModel):
    script_id: str
    participant: Literal["boss", "npc"]
    archetype_tags: list[str] = []
    nodes: dict[str, DialogueNode]
    start_node_id: str


class ChatMessage(BaseModel):
    speaker: Literal["boss", "npc", "player"]
    text: str


class ChatSession(BaseModel):
    contact_id: str
    script_id: str
    current_node: DialogueNode
    messages: list[ChatMessage]
