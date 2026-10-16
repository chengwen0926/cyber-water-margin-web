"""Restart the campaign, keeping a recoverable backup."""
from datetime import datetime
import shutil
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core import config
from data import save_manager
from models.save import PlayerSave

router = APIRouter(prefix='/api/game', tags=['game'])

class ResetRequest(BaseModel):
    confirmed: bool = False

@router.post('/reset')
def reset_game(body: ResetRequest):
    if not body.confirmed:
        raise HTTPException(400, '请先确认重新开始游戏')
    from api.day import advance_day
    root = config.RESOURCES_DIR
    save = save_manager.read()
    backup = root.parent / 'save_backups' / ('reset-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid4().hex[:8])
    names = ('save.json', 'emails.json', 'cases', 'npc_profiles', 'queues')
    try:
        backup.mkdir(parents=True)
        for name in names:
            source = root / name
            if source.is_dir():
                shutil.copytree(source, backup / name)
            elif source.exists():
                shutil.copy2(source, backup / name)
    except OSError as exc:
        raise HTTPException(500, '备份失败，原进度未更改') from exc
    try:
        for name in ('cases', 'npc_profiles', 'queues'):
            directory = root / name
            if directory.exists():
                shutil.rmtree(directory)
            directory.mkdir(parents=True)
        (root / 'emails.json').write_text('[]', encoding='utf-8')
        # Keep call revisions monotonic so an existing SSE client sees the new call.
        save_manager.write(PlayerSave(desktop_settings=save.desktop_settings,
            archive_case_ids=[], friend_case_ids=[], chat_call_revision=save.chat_call_revision,
            handled_call_revision=save.chat_call_revision))
        advance_day()
    except Exception as exc:
        try:
            for name in names:
                if name == 'save.json':
                    continue
                target, source = root / name, backup / name
                if target.is_dir():
                    shutil.rmtree(target)
                elif target.exists():
                    target.unlink()
                if source.is_dir():
                    shutil.copytree(source, target)
                elif source.exists():
                    shutil.copy2(source, target)
            save_manager.write(save)
        except Exception as restore_error:
            raise HTTPException(500, f'恢复失败，请保留备份 {backup.name} 并联系维护者') from restore_error
        raise HTTPException(500, '重新开始失败，原进度已恢复') from exc
    return {'day': 1, 'backup': backup.name}
