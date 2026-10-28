from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class DialogueOption(BaseModel):
    option_id: str
    text: str
    next_node_id: str


class DialogueBeat(BaseModel):
    text: str
    expression: Literal["smile", "recollect", "animated", "gaze", "grasp", "angry"]
    char_ms: int = Field(default=45, ge=10, le=200)
    pause_after_ms: int = Field(default=0, ge=0, le=3000)
    emphasis: list[str] = Field(default_factory=list)


class DialogueNode(BaseModel):
    node_id: str
    speaker: Literal["boss", "npc", "player"]
    text: str
    beats: list[DialogueBeat] = Field(default_factory=list)
    options: list[DialogueOption] = []
    reveals_clue: str | None = None
    reveals_directive: str | None = None

    @model_validator(mode="after")
    def beats_match_text(self):
        if self.beats and "".join(beat.text for beat in self.beats) != self.text:
            raise ValueError("dialogue beats must reproduce the full node text")
        return self


class ChatScript(BaseModel):
    script_id: str
    participant: Literal["boss", "npc"]
    archetype_tags: list[str] = []
    nodes: dict[str, DialogueNode]
    start_node_id: str


class ChatMessage(BaseModel):
    speaker: Literal["boss", "npc", "player"]
    text: str
    beats: list[DialogueBeat] = Field(default_factory=list)


class ChatSession(BaseModel):
    contact_id: str
    script_id: str
    current_node: DialogueNode
    messages: list[ChatMessage]
