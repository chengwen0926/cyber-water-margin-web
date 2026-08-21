from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.events import broadcaster
from data import case_loader, npc_loader, queue_store, save_manager, script_loader
from models.chat import ChatScript, DialogueNode
from services import state_machine

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
                name="领导",
                avatar="/avatars/boss.png",
                kind="boss",
                script_id=boss_scripts[0].script_id,
            )
        )

    queue = queue_store.load(max(save.current_day, 1))
    if queue is not None:
        for entry in queue.entries:
            try:
                case = case_loader.load(entry.case_id)
            except FileNotFoundError:
                continue
            if not case.resume.downloaded:
                continue
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
