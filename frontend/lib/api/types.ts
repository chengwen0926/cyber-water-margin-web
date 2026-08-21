export type ResumeField = {
  key: string;
  label: string;
  value: string;
  is_falsified: boolean;
  conflict_source: string | null;
};

export type ResumePhoto = {
  photo_url: string;
  is_anomalous: boolean;
  anomaly_note: string | null;
};

export type ResumeDocument = {
  case_id: string;
  fields: ResumeField[];
  photo: ResumePhoto;
  attachments: string[];
  downloaded: boolean;
};

export type Case = {
  case_id: string;
  npc_id: string;
  resume: ResumeDocument;
  chat_script_id: string;
};

export type NPCProfile = {
  npc_id: string;
  npc_name: string;
  npc_level: string;
  archetype: string;
  is_risk_target: boolean;
  avatar: string;
  medical_fields: ResumeField[];
  medical_report_scan_url: string;
};

export type MedicalRecordView = {
  npc_id: string;
  fields: ResumeField[];
  report_scan_url: string;
};

export type Clue = {
  clue_id: string;
  case_id: string;
  source: string;
  description: string;
  discovered: boolean;
};

export type DialogueOption = {
  option_id: string;
  text: string;
  next_node_id: string;
};

export type DialogueNode = {
  node_id: string;
  speaker: 'boss' | 'npc' | 'player';
  text: string;
  options: DialogueOption[];
  reveals_clue: string | null;
  reveals_directive: string | null;
};

export type ChatScript = {
  script_id: string;
  participant: 'boss' | 'npc';
  archetype_tags: string[];
  nodes: Record<string, DialogueNode>;
  start_node_id: string;
};

export type ChatContact = {
  id: string;
  name: string;
  avatar: string;
  kind: 'boss' | 'npc';
  script_id: string;
};

export type EmailAttachment = {
  attachment_id: string;
  case_id: string;
  filename: string;
};

export type Email = {
  email_id: string;
  day: number;
  sender: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
};

export type ReviewRule = {
  rule_id: string;
  field_key: string;
  check_type: string;
  description: string;
  severity: 'reject_if_violated' | 'flag_only';
};

export type DailySchedule = {
  day: number;
  npc_count: number;
  allowed_npc_levels: string[];
  review_rules: ReviewRule[];
};

export type QueueEntry = {
  position: number;
  case_id: string;
  arrival_state: 'waiting' | 'in_review' | 'done';
};

export type DailyQueue = {
  day: number;
  entries: QueueEntry[];
  generated_at_seed: number | null;
};

export type DailyGenerationResult = {
  queue: DailyQueue;
  cases: Case[];
  npc_profiles: NPCProfile[];
};

export type DirectiveCondition = {
  match_type: 'npc_archetype' | 'npc_id' | 'medical_field_value';
  match_key: string;
  match_value: string;
};

export type DirectiveAction = {
  action_type: 'secret_report' | 'force_reject' | 'force_approve' | 'flag_for_followup';
  action_payload: Record<string, unknown> | null;
};

export type SpecialDirective = {
  directive_id: string;
  triggered_by_chat_script_id: string;
  day_issued: number;
  condition: DirectiveCondition;
  action: DirectiveAction;
  covert: boolean;
  expires_day: number | null;
};

export type CaseJudgement = {
  case_id: string;
  player_verdict: 'approved' | 'rejected';
  correct_verdict: 'approved' | 'rejected';
  is_correct: boolean;
};

export type PenaltyAction = {
  action_type: 'warning' | 'salary_deduction' | 'trigger_ending' | 'boss_call_scripted';
  action_payload: Record<string, unknown> | null;
  severity: number;
};

export type PenaltyRecord = {
  day_triggered: number;
  rule_id: string;
  action: PenaltyAction;
};

export type DayResult = {
  day: number;
  judgements: CaseJudgement[];
  total_count: number;
  error_count: number;
  error_rate: number;
  directive_results: Record<string, boolean>;
  penalty_triggered: PenaltyRecord | null;
  is_final_day: boolean;
};

export type ArchiveSummary = {
  case_id: string;
  npc_id: string;
  npc_name: string;
  npc_level: string;
  avatar: string;
  verdict: 'approved' | 'rejected' | null;
};

export type ArchiveDetail = {
  case: Case;
  flagged_field_keys: string[];
};

export type IncomingCallEvent = {
  event: 'incoming_call';
  script_id: string;
};
