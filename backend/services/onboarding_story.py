"""Idempotent content upgrade for the document-authored first-day story."""
from data import case_loader, npc_loader, email_loader, save_manager
from models.email import Email, EmailAttachment


def ensure_story(replay_opening=True):
    save = save_manager.read()
    if save.current_day < 1:
        return
    try:
        case = case_loader.load("case_1_0")
        profile = npc_loader.load(case.npc_id)
    except FileNotFoundError:
        return
    if case.chat_script_id != "npc_lvshi_interview_01":
        case.chat_script_id = "npc_lvshi_interview_01"
        case_loader.save(case)
    if profile.npc_name != "吕师" or profile.employee_id != "NET-0311":
        profile.npc_name = "吕师"
        profile.employee_id = "NET-0311"
        npc_loader.save(profile)
    emails = {e.email_id for e in email_loader.load_all()}
    if "story_offer_01" not in emails:
        email_loader.append(Email(email_id="story_offer_01",day=1,sender="宋王星集团人事自动化 <hr-bot@songwangxing.corp>",subject="录用通知书｜调查专员（反公司活动调查部）",body="收件人：调查部终端 · INV-0007\n入职日 07:50\n\n恭喜你通过调查专员岗位面试，欢迎加入宋王星集团。\n现邮件向你发出正式录用通知。你的岗位隶属「反公司活动调查部」。请严格遵守保密条例，不得向无关人员透露任何相关信息。\n今日请于终端登录后待命。部门主管将另行联络。\n——人力资源服务中心（自动发送）",attachments=[]))
    if "story_gaoqiu_lvshi_01" not in emails:
        email_loader.append(Email(email_id="story_gaoqiu_lvshi_01",day=1,sender="高俅 · 反公司活动调查部 部长",subject="QH001-L｜代号：摩尼｜吕师调查档案",body="对象：吕师（工号 NET-0311）。\n邮件编号：QH001-L    代号：摩尼\n\n这人跟昨夜袭击有牵连。好好地检查他的履历，从他嘴里问出点真东西。\n\n——高俅\n反公司活动调查部 部长",attachments=[EmailAttachment(attachment_id="story_lvshi_resume",case_id=case.case_id,filename="吕师_基本档案.ssf")]))

    if replay_opening and save.current_day == 1 and save.latest_boss_script_id in (None, "boss_call_checkin_01"):
        from services.chat_notifications import publish_call
        publish_call("boss_gaoqiu_onboarding_01")
