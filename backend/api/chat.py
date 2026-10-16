from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.events import broadcaster
from data import case_loader, npc_loader, save_manager, script_loader
from models.chat import ChatMessage, ChatScript, ChatSession, DialogueNode
from services import chat_sessions, state_machine

router = APIRouter(prefix="/api/chat", tags=["chat"])


class AdvanceRequest(BaseModel):
    option_id: str | None = None


class ChatContact(BaseModel):
    id: str
    name: str
    avatar: str
    kind: str
    script_id: str


@router.get("/scripts/{script_id}", response_model=ChatScript)
def get_script(script_id: str) -> ChatScript:
    try:
        return script_loader.load_script(script_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{script_id}/current", response_model=DialogueNode)
def get_current_node(script_id: str) -> DialogueNode:
    """Resume point for this script: whatever node save.chat_progress last
    left off at, or the start node if the conversation hasn't begun yet.
    Read-only — does not mutate progress, unlike /advance."""
    try:
        script = script_loader.load_script(script_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    save = save_manager.read()
    current_node_id = save.chat_progress.get(script_id, script.start_node_id)
    current_node = script.nodes.get(current_node_id)
    if current_node is None:
        raise HTTPException(status_code=400, detail="invalid current node")
    return current_node


@router.get("/contacts", response_model=list[ChatContact])
def list_contacts() -> list[ChatContact]:
    save = save_manager.read()
    contacts: list[ChatContact] = []

    boss_scripts = script_loader.load_all_boss_scripts()
    if boss_scripts:
        contacts.append(
            ChatContact(
                id="boss",
                name="高俅",
                avatar="/avatars/boss.png",
                kind="boss",
                script_id=save.latest_boss_script_id or boss_scripts[0].script_id,
            )
        )

    # Keep every downloaded candidate available. Chat history is persistent
    # across days, so limiting contacts to today's queue makes older
    # conversations disappear from the read archive.
    cases = sorted(
        (case for case in case_loader.load_all() if (case.case_id in save.friend_case_ids if save.friend_case_ids is not None else case.resume.downloaded)),
        key=lambda case: case.case_id,
    )
    for case in cases:
        try:
            profile = npc_loader.load(case.npc_id)
        except FileNotFoundError:
            continue
        contacts.append(
            ChatContact(
                id=case.case_id,
                name=profile.npc_name,
                avatar=profile.avatar,
                kind="npc",
                script_id=case.chat_script_id,
            )
        )
    return contacts


@router.post("/{script_id}/advance", response_model=DialogueNode)
def advance(script_id: str, body: AdvanceRequest) -> DialogueNode:
    try:
        script = script_loader.load_script(script_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    save = save_manager.read()
    current_node_id = save.chat_progress.get(script_id, script.start_node_id)
    current_node = script.nodes.get(current_node_id)
    if current_node is None:
        raise HTTPException(status_code=400, detail="invalid current node")

    if body.option_id is None:
        if current_node.options:
            raise HTTPException(
                status_code=400, detail="option_id required for this node"
            )
        next_node_id = current_node_id
    else:
        option = next(
            (o for o in current_node.options if o.option_id == body.option_id), None
        )
        if option is None:
            raise HTTPException(status_code=400, detail="invalid option_id")
        next_node_id = option.next_node_id

    next_node = script.nodes.get(next_node_id)
    if next_node is None:
        raise HTTPException(status_code=400, detail="dangling next_node_id")

    def mutate(s):
        s.chat_progress[script_id] = next_node_id
        if next_node.reveals_clue and next_node.reveals_clue not in s.discovered_clues:
            s.discovered_clues.append(next_node.reveals_clue)
        if next_node.reveals_directive:
            state_machine.materialize_directive(
                next_node.reveals_directive, s.current_day, s
            )
        return s

    save_manager.update(mutate)
    return next_node


class SessionAdvanceRequest(BaseModel):
    script_id: str
    option_id: str
    expected_node_id: str


def _contact_script(contact_id: str, script_id: str) -> ChatScript:
    contact = next((c for c in list_contacts() if c.id == contact_id), None)
    if contact is None or contact.script_id != script_id:
        raise HTTPException(status_code=404, detail="conversation not available")
    return get_script(script_id)


@router.get("/sessions/{contact_id}", response_model=ChatSession)
def get_session(contact_id: str, script_id: str) -> ChatSession:
    script = _contact_script(contact_id, script_id)
    return chat_sessions.snapshot(save_manager.read(), contact_id, script)


@router.post("/sessions/{contact_id}/advance", response_model=ChatSession)
def advance_session(contact_id: str, body: SessionAdvanceRequest) -> ChatSession:
    script = _contact_script(contact_id, body.script_id)
    result = None

    def mutate(save):
        nonlocal result
        session = chat_sessions.snapshot(save, contact_id, script)
        current = session.current_node
        if current.node_id != body.expected_node_id:
            raise HTTPException(status_code=409, detail="conversation has advanced")
        option = next((o for o in current.options if o.option_id == body.option_id), None)
        if option is None:
            raise HTTPException(status_code=400, detail="invalid option_id")
        next_node = script.nodes.get(option.next_node_id)
        if next_node is None:
            raise HTTPException(status_code=400, detail="dangling next_node_id")
        key = chat_sessions.session_key(contact_id, script.script_id, save.chat_call_revision if contact_id == "boss" else 0)
        save.chat_transcripts[key] = [*session.messages,
            ChatMessage(speaker="player", text=option.text),
            ChatMessage(speaker=next_node.speaker, text=next_node.text)]
        save.conversation_progress[key] = next_node.node_id
        if next_node.reveals_clue and next_node.reveals_clue not in save.discovered_clues:
            save.discovered_clues.append(next_node.reveals_clue)
        if next_node.reveals_directive:
            state_machine.materialize_directive(next_node.reveals_directive, save.current_day, save)
        result = chat_sessions.snapshot(save, contact_id, script)

    save_manager.update(mutate)
    return result


class SessionMessageRequest(BaseModel):
    script_id: str
    text: str = Field(min_length=1, max_length=1000)
    expected_node_id: str
    expected_message_count: int = Field(ge=0)


@router.post("/sessions/{contact_id}/messages", response_model=ChatSession)
def send_message(contact_id: str, body: SessionMessageRequest) -> ChatSession:
    script = _contact_script(contact_id, body.script_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "消息不能为空")
    result = None

    def mutate(save):
        nonlocal result
        session = chat_sessions.snapshot(save, contact_id, script)
        current = session.current_node
        if current.node_id != body.expected_node_id or len(session.messages) != body.expected_message_count:
            raise HTTPException(409, "聊天记录已更新，请同步后重试")
        # Only an explicit authored answer advances the plot; free text never
        # fabricates a clue, personal fact, or instruction from a character.
        option = next((o for o in current.options if o.text.strip() == text), None)
        next_node = script.nodes[option.next_node_id] if option else current
        if option:
            reply = next_node.text
        elif any(word in text for word in ("再说", "重复", "什么意思", "说明", "要求")):
            reply = "我目前能说明的是：" + (current.text if current.options else script.nodes[script.start_node_id].text)
        elif any(word in text for word in ("你好", "您好")):
            reply = "你好，我在。" + ("我们接着谈：" + current.text if current.options else "刚才的交流已记录，你可以继续留言。")
        elif current.options:
            reply = "收到你的消息。关于刚才的问题：" + current.text + "\n你可以选择下方的回复继续确认。"
        else:
            reply = "收到你的补充留言。本次面谈的事项已记录。"
        key = chat_sessions.session_key(contact_id, script.script_id, save.chat_call_revision if contact_id == "boss" else 0)
        save.chat_transcripts[key] = [*session.messages, ChatMessage(speaker="player", text=text),
            ChatMessage(speaker="boss" if contact_id == "boss" else "npc", text=reply)]
        if option:
            save.conversation_progress[key] = next_node.node_id
            if next_node.reveals_clue and next_node.reveals_clue not in save.discovered_clues:
                save.discovered_clues.append(next_node.reveals_clue)
            if next_node.reveals_directive:
                state_machine.materialize_directive(next_node.reveals_directive, save.current_day, save)
        result = chat_sessions.snapshot(save, contact_id, script)

    save_manager.update(mutate)
    return result
