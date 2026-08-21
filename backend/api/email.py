from __future__ import annotations

from fastapi import APIRouter, HTTPException

from data import case_loader, email_loader, save_manager
from models.email import Email

router = APIRouter(prefix="/api/email", tags=["email"])


@router.get("", response_model=list[Email])
def list_emails() -> list[Email]:
    save = save_manager.read()
    return [e for e in email_loader.load_all() if e.day <= max(save.current_day, 0)]


@router.get("/{email_id}", response_model=Email)
def get_email(email_id: str) -> Email:
    for email in email_loader.load_all():
        if email.email_id == email_id:
            return email
    raise HTTPException(status_code=404, detail="email not found")


@router.post("/{email_id}/attachments/{attachment_id}/download")
def download_attachment(email_id: str, attachment_id: str) -> dict:
    email = get_email(email_id)
    attachment = next(
        (a for a in email.attachments if a.attachment_id == attachment_id), None
    )
    if attachment is None:
        raise HTTPException(status_code=404, detail="attachment not found")

    try:
        case = case_loader.load(attachment.case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    case.resume.downloaded = True
    case_loader.save(case)

    def mutate(save):
        if attachment_id not in save.downloaded_attachments:
            save.downloaded_attachments.append(attachment_id)
        return save

    save_manager.update(mutate)
    return {"case_id": case.case_id, "downloaded": True}
