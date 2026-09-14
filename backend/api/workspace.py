from __future__ import annotations

from uuid import uuid4
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from data import case_loader, npc_loader, save_manager, email_loader, script_loader
from services import chat_sessions, clue_manager
from services.company_library import RECORDS

router = APIRouter(prefix='/api/workspace', tags=['workspace'])

class Source(BaseModel):
    kind: Literal['resume', 'medical', 'chat', 'history']
    id: str = Field(min_length=1, max_length=200)

class ItemRequest(BaseModel):
    action: Literal['folder', 'copy', 'move', 'rename', 'delete', 'restore']
    item_id: str | None = None
    parent_id: str | None = None
    name: str = Field(default='', max_length=80)
    source: Source | None = None

class Settings(BaseModel):
    brightness: int = Field(ge=40, le=100)
    icon_size: int = Field(ge=48, le=96)
    motion: bool = True

class ImportRequest(BaseModel):
    source: Source
    case_id: str | None = None

class FriendRequest(BaseModel):
    contact: str = Field(min_length=1, max_length=200)


def initialize(save):
    old = [c.case_id for c in case_loader.load_all() if c.resume.downloaded]
    if save.archive_case_ids is None:
        save.archive_case_ids = old.copy()
    if save.friend_case_ids is None:
        save.friend_case_ids = old.copy()


def visible_case(case_id):
    try:
        case = case_loader.load(case_id)
    except FileNotFoundError:
        raise HTTPException(404, '文件不存在')
    save = save_manager.read()
    available = case.resume.downloaded or any(e.day <= save.current_day and any(a.case_id == case_id for a in e.attachments) for e in email_loader.load_all())
    if not available:
        raise HTTPException(404, '文件尚未送达')
    return case


def document(source: Source):
    if source.kind == 'history':
        record = next((r for r in RECORDS if r['id'] == source.id), None)
        if not record:
            raise HTTPException(404, '历史档案不存在')
        return {'source': source.model_dump(), 'title': record['title'], 'case_id': None, 'fields': [], 'body': record['body'], 'contact': None}
    case = visible_case(source.id)
    profile = npc_loader.load(case.npc_id)
    fields, body = [], ''
    if source.kind == 'resume':
        fields = [{'key': f.key, 'label': f.label, 'value': f.value} for f in case.resume.fields]
        title = f'{profile.npc_name} · 个人简历'
        body = '候选人自述材料，信息有待独立核实。'
    elif source.kind == 'medical':
        fields = [{'key': f.key, 'label': f.label, 'value': f.value} for f in profile.medical_fields]
        title = f'{profile.npc_name} · 核验原件'
        body = '医疗库提供的原始登记资料。请结合各项资料与当天审查规则判断。'
    else:
        save = save_manager.read()
        if save.friend_case_ids is not None and case.case_id not in save.friend_case_ids:
            raise HTTPException(400, '请先添加该候选人为好友')
        script = script_loader.load_script(case.chat_script_id)
        session = chat_sessions.snapshot(save, case.case_id, script)
        if not any(m.speaker == 'player' for m in session.messages):
            raise HTTPException(400, '完成一次对话后才能归档聊天记录')
        body = '\n'.join(('我' if m.speaker == 'player' else profile.npc_name) + '：' + m.text for m in session.messages)
        title = f'{profile.npc_name} · 对话记录'
    return {'source': source.model_dump(), 'title': title, 'case_id': case.case_id, 'fields': fields, 'body': body, 'contact': f'{case.npc_id}@localnet', 'name': profile.npc_name}


@router.get('')
def state():
    save = save_manager.update(initialize)
    return {'items': save.desktop_items, 'settings': save.desktop_settings}


@router.post('/document')
def preview(source: Source):
    return document(source)


@router.get('/library')
def library():
    return RECORDS


@router.post('/settings')
def settings(body: Settings):
    save_manager.update(lambda s: setattr(s, 'desktop_settings', body.model_dump()))
    return body


@router.post('/items')
def items(body: ItemRequest):
    doc = document(body.source) if body.action == 'copy' and body.source else None
    def mutate(save):
        initialize(save)
        entries = save.desktop_items
        by_id = {i['id']: i for i in entries}
        target = by_id.get(body.item_id)
        if body.action not in ('copy', 'folder') and not target:
            raise HTTPException(404, '文件不存在')
        if body.parent_id:
            parent = by_id.get(body.parent_id)
            if not parent or parent['kind'] != 'folder' or parent.get('deleted'):
                raise HTTPException(400, '目标文件夹不可用')
        if body.action in ('move', 'copy', 'folder'):
            ancestor = body.parent_id
            while ancestor:
                if ancestor == body.item_id:
                    raise HTTPException(400, '不能将文件夹移入自身或子文件夹')
                ancestor = by_id[ancestor].get('parent_id')
        if body.action in ('copy', 'folder'):
            if body.action == 'copy' and doc is None:
                raise HTTPException(400, '缺少文件来源')
            if len(entries) >= 500:
                raise HTTPException(400, '桌面文件数量已达上限')
            name = body.name.strip() or (doc['title'] if doc else '未命名文件夹')
            entries.append({'id': str(uuid4()), 'kind': 'file' if doc else 'folder', 'name': name,
                'parent_id': body.parent_id, 'deleted': False, 'source': body.source.model_dump() if doc else None})
        elif body.action == 'move':
            if target.get('deleted'):
                raise HTTPException(400, '请先从废纸篓恢复文件')
            target['parent_id'] = body.parent_id
        elif body.action == 'rename':
            if not body.name.strip():
                raise HTTPException(400, '名称不能为空')
            target['name'] = body.name.strip()
        elif body.action == 'delete':
            target['deleted'] = True
        elif body.action == 'restore':
            target['deleted'] = False
            target['parent_id'] = None
    save = save_manager.update(mutate)
    return {'items': save.desktop_items, 'settings': save.desktop_settings}


@router.post('/friends')
def add_friend(body: FriendRequest):
    contact = body.contact.strip().lower()
    match = next((c for c in case_loader.load_all() if f'{c.npc_id}@localnet'.lower() == contact), None)
    if match is None:
        raise HTTPException(404, '没有找到该联系方式，请核对简历')
    visible_case(match.case_id)
    def mutate(save):
        initialize(save)
        if match.case_id not in save.friend_case_ids:
            save.friend_case_ids.append(match.case_id)
    save_manager.update(mutate)
    return {'case_id': match.case_id, 'name': npc_loader.load(match.npc_id).npc_name}


@router.post('/import')
def import_document(body: ImportRequest):
    doc = document(body.source)
    case_id = body.case_id or doc['case_id']
    if not case_id:
        raise HTTPException(400, '请先选择需要补充信息的候选人档案')
    case = visible_case(case_id)
    if doc['case_id'] and doc['case_id'] != case_id:
        raise HTTPException(400, '材料所属候选人与当前档案不符')
    def mutate(save):
        initialize(save)
        if case_id not in save.archive_case_ids:
            if body.source.kind != 'resume':
                raise HTTPException(400, '请先拖入简历建立档案')
            save.archive_case_ids.append(case_id)
        if body.source.kind == 'medical':
            for clue in clue_manager.diff_medical_vs_resume(npc_loader.load(case.npc_id), case.resume):
                if clue.clue_id not in save.discovered_clues:
                    save.discovered_clues.append(clue.clue_id)
        evidence = save.archive_evidence.setdefault(case_id, [])
        # The server resolves and snapshots evidence. Client text is never trusted.
        previous = next((i for i in evidence if i['source'] == doc['source']), None)
        if previous is not None:
            evidence[evidence.index(previous)] = doc
        else:
            evidence.append(doc)
    save_manager.update(mutate)
    if body.source.kind == 'resume':
        case.resume.downloaded = True
        case_loader.save(case)
    return assessment(case_id)


@router.get('/assessment/{case_id}')
def assessment(case_id: str):
    case = visible_case(case_id)
    save = save_manager.read()
    if save.archive_case_ids is not None and case_id not in save.archive_case_ids:
        raise HTTPException(404, '尚未建立档案')
    evidence = save.archive_evidence.get(case_id, [])
    trusted = {f['key']: f['value'] for doc in evidence if doc['source']['kind'] == 'medical' for f in doc['fields']}
    points = [{'key': f.key, 'label': f.label, 'declared': f.value,
        'verified': trusted.get(f.key), 'status': 'unknown' if f.key not in trusted else 'verified' if trusted[f.key] == f.value else 'conflict'} for f in case.resume.fields]
    unknown = sum(p['status'] == 'unknown' for p in points)
    conflicts = sum(p['status'] == 'conflict' for p in points)
    return {'case_id': case_id, 'unknown': unknown, 'conflicts': conflicts,
        'verified': len(points) - unknown - conflicts, 'points': points, 'evidence': evidence,
        'summary': '发现材料矛盾，请结合原件判断' if conflicts else '仍有信息待核实' if unknown else '现有材料相互一致，请按今日规则判断'}
