# 《赛博水浒入职日》数据结构设计文档

架构约定：前端 Next.js，后端 FastAPI，数据以本地 JSON 文件持久化（静态配置 + `save.json` 动态存档），详见 `specs.md`。本文档聚焦玩法层面的数据结构设计。

---

## 一、数据分层

```
resources/json/
├── cases/                       # 案例库（静态，策划配置/工厂生成）
│   ├── case_001.json            # 单个应聘者的简历包（不含体检原件）
│   └── case_002.json
├── npc_profiles/                # NPC 身份与真相（静态/工厂生成，按 npc_id 独立存储，含医疗字段）
│   └── npc_001.json
├── schedules/                   # 每日固定工作安排（静态）
│   └── day_01.json
├── scripts/
│   ├── boss_calls.json          # 领导视频通话对话脚本（静态，含特殊指令触发点）
│   └── npc_chats/
│       └── case_001_chat.json   # 每个NPC的视频面谈对话树（静态）
└── save.json                    # 玩家进度存档（动态，运行时读写）
```

`Case` 聚合的是"这次投递"相关的呈现内容（简历、对话脚本引用），`NPCProfile` 则按 `npc_id` 独立存储 NPC 的身份与真实信息（含体检字段）——医疗库在玩法上是另一个软件，数据上也应是独立于案例包之外的真相来源，而非案例包自带的附属资产；医疗库展示内容由 `NPCProfile` 投影得到，不再单独持久化一份 `MedicalRecord`（详见二、1 和二、4）。

---

## 二、核心实体（Pydantic Models）

### 1. `NPCProfile`（NPC 身份骨架）—— 一个应聘者的身份与真相

```python
class NPCProfile(BaseModel):
    npc_id: str
    npc_name: str
    npc_level: str                 # 候选人级别，用于和 DailySchedule.allowed_npc_levels 比对
    archetype: str                 # 性格/风格原型，取自策划预定义的有限枚举，如 "honest" | "nervous_liar" | "confident_liar"
    is_risk_target: bool           # 是否是本轮真正的风险对象（判定用真值）
    avatar: str
    medical_fields: list["ResumeField"]  # 真实字段，即体检报告的内容
    medical_report_scan_url: str         # 体检报告原件扫描图
```

`NPCProfile` 描述的是"这个人是谁、真实情况如何"，与"他这次投递了什么材料"（`Case`）是两回事，因此拆成独立的类：一个 NPC 的身份信息在生成后是唯一的，`medical_fields`/`medical_report_scan_url` 只存这一份，是简历造假比对、医疗库展示唯一的真相来源，不再另外维护一个持久化的 `MedicalRecord` 副本（见二、4）。

### 2. `Case`（案例包）—— 一次投递的呈现材料

```python
class Case(BaseModel):
    case_id: str
    npc_id: str                    # 关联 NPCProfile，身份与真相不内嵌在 Case 里
    resume: "ResumeDocument"       # NPC自己提交、可能造假的简历
    chat_script_id: str            # 关联到 npc_chats/xxx.json
```

`Case` 只负责"这一次投递材料的呈现与流转"，本身很轻。玩家在"档案"软件看到的 NPC 姓名、级别、头像等身份信息，通过 `case.npc_id` 关联查询 `NPCProfile` 获得，而不是在 `Case` 上重复定义。**候选人当天"该不该通过"不是静态字段**，而是由后端结合当天 `DailySchedule.review_rules` 动态计算（见五、1）。

### 3. `ResumeDocument`（简历/档案软件中展示的文档）

```python
class ResumeField(BaseModel):
    key: str                      # e.g. "gender", "health_status", "graduation_year"
    label: str
    value: str
    is_falsified: bool            # 该字段是否被NPC篡改（后端判定用，前端不可见）
    conflict_source: str | None   # 冲突证据来自哪（"npc_profile.medical_fields.health_status" / "chat.node_5"）

class ResumePhoto(BaseModel):
    photo_url: str
    is_anomalous: bool            # 照片是否被篡改（PS/拼接/张冠李戴等）
    anomaly_note: str | None      # 异常说明，仅在 is_anomalous=True 时有值

class ResumeDocument(BaseModel):
    case_id: str
    fields: list[ResumeField]     # 含 gender/health_status/marital_status/graduation_year/criminal_record/prior_employment
    photo: ResumePhoto            # 简历照片，独立于文字字段的另一条造假线索
    attachments: list[str]        # 附带的其他文件资源路径
    downloaded: bool              # 是否已从邮箱下载到本地（存档字段）
```

`ResumeField.value` 与 `NPCProfile.medical_fields` 中同 key 字段的值故意允许不一致，这是**文字字段**造假的来源；`ResumePhoto.is_anomalous` 则是**照片**这条独立造假线索，两者互不重叠、需要玩家用不同手段分别核验（见下）。

**"档案"与"医疗库"的核验分工是刻意拆开的**：
- **档案软件的"一键发现问题"** 只调用 `services/clue_manager.check_resume_photo()`，只检测 `resume.photo.is_anomalous`，永远不会去检查 `fields` 里的文字造假——这是为了保证"一键"不能替玩家把所有活都干完，逼迫玩家必须去医疗库人工核对文字信息。
- **文字字段的造假**（`is_falsified=True`）只能通过打开"医疗库"，用 `services/clue_manager.diff_medical_vs_resume()` 把 `resume.fields` 与 `NPCProfile.medical_fields` 按 key 逐一比对才能发现，档案软件本身不提供这个能力。

### 4. 医疗库视图（不落盘为独立模型，由 `NPCProfile` 投影得到）

医疗库在玩法上是独立于"档案"软件之外的另一个查询入口，但数据上不再单独持久化一份 `MedicalRecord` —— 之前的设计里 `MedicalRecord.fields` 和 `NPCProfile.medical_fields` 各存一份，靠约定"生成时写入同一份数据"保持一致，实际上是同一份真相的两个副本，仍需人工保证同步。现在改为纯视图：由 API 层从 `NPCProfile` 按需组装响应，不再是需要落盘同步的独立实体。

```python
def build_medical_record_view(profile: NPCProfile) -> dict:
    return {
        "npc_id": profile.npc_id,
        "fields": profile.medical_fields,
        "report_scan_url": profile.medical_report_scan_url,
    }
```

`/api/medical/{npc_id}` 内部调用 `npc_loader.load(npc_id)` 取回 `NPCProfile`，再经 `build_medical_record_view` 转成前端需要的形状；字段 key 与 `ResumeDocument.fields` 保持同名（如都叫 `health_status`），前端做"体检库 vs 简历"对比时可以直接按 key 做 diff，不用做语义匹配。`POST /api/medical/{npc_id}/compare/{case_id}` 是玩家主动触发的比对动作，产出 `source="medical_diff"` 的 `Clue`；医疗库视图本身不涉及照片。

### 5. 聊天/视频通话相关

```python
class DialogueOption(BaseModel):
    option_id: str
    text: str
    next_node_id: str

class DialogueNode(BaseModel):
    node_id: str
    speaker: str                  # "boss" | "npc" | "player"
    text: str
    options: list[DialogueOption] # 玩家可选回复，空则线性推进
    reveals_clue: str | None      # 触发后解锁的线索id
    reveals_directive: str | None # 触发后下发的特殊指令id（仅领导来电脚本会用到）

class ChatScript(BaseModel):
    script_id: str
    participant: Literal["boss", "npc"]
    nodes: dict[str, DialogueNode]
    start_node_id: str
```

领导来电和与NPC的视频面谈，复用同一个 `ChatScript`/`DialogueNode` 结构，区别只在 `participant`；领导来电脚本额外使用 `reveals_directive` 下发特殊指令。

### 6. 邮件相关

```python
class EmailAttachment(BaseModel):
    attachment_id: str
    case_id: str                  # 关联的简历案例
    filename: str

class Email(BaseModel):
    email_id: str
    day: int
    sender: str
    subject: str
    body: str
    attachments: list[EmailAttachment]
```

### 7. `Clue`（线索）

```python
class Clue(BaseModel):
    clue_id: str
    case_id: str
    source: str                   # "medical_diff" | "chat_node_5" | "resume_conflict"
    description: str
    discovered: bool              # 存档字段
```

---

## 三、每日固定工作安排 `DailySchedule`

与"领导不定期视频通话"是两种性质不同的机制：`DailySchedule` 是**确定性配置**，每天自动生效、无需玩家触发；下节的 `SpecialDirective` 是**事件触发的动态指令**，由领导来电对话树临时下发。

```python
class ReviewRule(BaseModel):
    rule_id: str
    field_key: str                 # 对应 ResumeField.key，规则作用的字段
    check_type: str                # "must_match_medical" | "must_be_present" | "value_in_range" 等
    description: str               # 展示给玩家的规则说明，如"今日需核验所有人的婚姻状况"
    severity: Literal["reject_if_violated", "flag_only"]  # 违规是否直接构成拒绝理由

class DailySchedule(BaseModel):
    day: int
    npc_count: int                 # 当天来多少人
    allowed_npc_levels: list[str]  # 今天允许通过的NPC级别，如 ["intern", "staff"]
    review_rules: list[ReviewRule] # 今日审查规则集
```

下发方式：每天自动出现在"邮箱"里（作为一封系统邮件，无需玩家"发现"），或在进入新一天时由前端调用 `/api/schedule/today` 拉取；不走聊天/视频通话这条线。当天具体来了谁、排队顺序是什么，不在 `DailySchedule` 里静态列出，而是由 `DailyQueueBuilder`（见八）在运行时依据这些边界条件生成。

同一个 `Case` 在不同天、不同 `review_rules` 下，"该不该通过"的标准答案可能不同——这正是"今日审查规则"存在的意义，因此判定逻辑必须放在运行时（`services/verdict_checker.py`），而非写死在 `Case` 静态数据中。

---

## 四、领导不定期特殊指令 `SpecialDirective`

挂在聊天/视频通话脚本体系下，由领导来电这一事件触发，下发的是**条件-动作**指令而非规则。

```python
class DirectiveCondition(BaseModel):
    match_type: Literal["npc_archetype", "npc_id", "medical_field_value"]
    match_key: str                 # match_type=medical_field_value 时对应 ResumeField.key，如 "health_status"
    match_value: str               # 如 archetype="nervous_liar" 或 health_status="隐瞒病史"

class DirectiveAction(BaseModel):
    action_type: Literal["secret_report", "force_reject", "force_approve", "flag_for_followup"]
    action_payload: dict | None    # 如 secret_report 需要 {"report_to": "boss"}

class SpecialDirective(BaseModel):
    directive_id: str
    triggered_by_chat_script_id: str   # 哪段领导来电对话触发的
    day_issued: int
    condition: DirectiveCondition      # 满足什么条件时该对哪个候选人执行动作
    action: DirectiveAction
    covert: bool                       # 是否"悄悄地"——执行后不体现在正常审查流程里
    expires_day: int | None            # 指令有效期，过期自动失效
```

`SpecialDirective` 由某个 `DialogueNode.reveals_directive` 触发产生。

---

## 五、存档层 `PlayerSave`

```python
class PlayerSave(BaseModel):
    current_day: int
    unlocked_emails: list[str]
    downloaded_attachments: list[str]        # 已下载进"档案"的附件id
    resume_field_flags: dict[str, list[str]] # case_id -> 已被玩家标记为可疑的field key
    discovered_clues: list[str]
    chat_progress: dict[str, str]            # script_id -> 当前所在node_id（支持中途退出续聊）
    case_verdicts: dict[str, Literal["approved", "rejected"]]  # 玩家对每个case的最终决定
    active_directives: list[str]             # 当前生效中的特殊指令id
    completed_directive_actions: dict[str, str]  # directive_id -> 玩家实际执行的动作
```

存档只记录"玩家做了什么/发现了什么"，不重复存放静态内容本身（`Case`/`ChatScript`/`DailySchedule` 都按 id 引用），保证 `save.json` 体积小、且策划改配置不会污染存档。

`completed_directive_actions` 单独记录、不并入 `case_verdicts` 的原因：像"悄悄举报"这种 covert 动作不应出现在常规通过/拒绝记录里，它是一条隐藏支线，可能影响结局分支，和"这个人有没有被正常录用"是两件事，必须分开存，否则无法实现"表面通过了但其实被你举报了"这种叙事效果。

### 1. 判定逻辑（动态计算，非存档字段）

后端在玩家提交 `case_verdicts` 或查询当前状态时，结合以下输入动态计算"标准答案"：
- `DailySchedule.review_rules`（今日规则）
- `DailySchedule.allowed_npc_levels` + `NPCProfile.npc_level`（通过 `Case.npc_id` 关联查询）
- `Case.resume` vs `NPCProfile.medical_fields` 的字段差异

计算逻辑放在 `services/verdict_checker.py`，用于校验玩家的 `case_verdicts` 是否正确、以及 `SpecialDirective.condition` 是否被满足。

---

## 六、层级关系图

```
                              GameState（运行时聚合根，每次请求构建）
                                    │
        ┌───────────────────────────┼────────────────────────────┐
        ▼                           ▼                             ▼
  DailySchedule(静态)          DailyQueue(存档)              PlayerSave(存档)
   ├─ review_rules[]                │                     ├─ discovered_clues
   ├─ allowed_npc_levels[]          │ entries[].case_id    ├─ case_verdicts
   └─ npc_count                     │                      ├─ active_directives
        │                           ▼                      ├─ completed_directive_actions
        │                    ┌──────────────┐               ├─ day_results
        ▼                    │DailyQueueBuilder│             ├─ penalty_records
  NPCFactory.generate() ──▶ NPCProfile          │            └─ strikes
        │                    │ (npc_level/       │                  ▲
        │                    │  archetype/       │                  │
        │                    │  is_risk_target/  │                  │
        │                    │  medical_fields[]/│                  │
        │                    │  medical_scan_url)│                  │
        │                    └────────┬──────────┘                  │
        ▼                             │  (落盘为唯一真相来源，                │
        │                             │   医疗库按 npc_id 从此投影展示)          │
        ▼                             │                              │
  ResumeFactory.generate() ◀──────────┘                              │
        │  (参考 schedule.review_rules 制造篡改点)                     │
        ▼                                                            │
  ScriptMatcher.pick() ──▶ ChatScript(按 archetype_tags 匹配，策划手写)  │
        │                                                            │
        ▼                                                            │
      Case(npc_id引用) ── ResumeDocument / chat_script_id            │
        │        （resume.fields 与 NPCProfile.medical_fields 同名 key 用于比对） │
        ▼                                                            │
      Clue（比对/对话中产出）────────────────────────────────────────┘
        │
        ▼
  verdict_checker.py（动态计算：结合 schedule.review_rules +
                       case.resume vs npc_profile.medical_fields + save 已发现线索，
                       判断 case 今日该不该通过）── 产出 CaseJudgement
        │
        ▼
  day_result_builder.py ──▶ DayResult(error_rate/directive_results)
        │
        ▼
  PenaltyChecker.evaluate() ──▶ PenaltyRecord（触发时可复用 boss ChatScript
                                 弹出警告来电，写回 save.penalty_records/strikes）


ChatScript(领导来电，不定期，与上面NPC面谈脚本同结构不同participant)
        │
        ▼
  DialogueNode.reveals_directive
        │
        ▼
  SpecialDirective（condition + action，covert动作单独走
                    completed_directive_actions，不进入 case_verdicts）
```

---

## 七、后端目录建议（在 `specs.md` 基础上细化）

```
backend/
├── api/
│   ├── email.py
│   ├── archive.py          # 对应"档案"软件
│   ├── medical.py          # 对应"医疗库"，从 NPCProfile 投影出医疗记录视图
│   ├── chat.py             # 领导来电 + NPC视频面谈统一走这里
│   ├── schedule.py         # 每日固定工作安排
│   └── review.py           # 玩家提交最终判定（通过/拒绝）
├── services/
│   ├── state_machine.py
│   ├── clue_manager.py     # 比对 resume vs npc_profile.medical_fields 生成/校验线索
│   └── verdict_checker.py  # 动态计算判定标准 + 校验玩家结论/指令达成情况
├── data/
│   ├── case_loader.py      # 加载 cases/*.json
│   ├── npc_loader.py       # 加载 npc_profiles/*.json（NPCProfile，含医疗字段）
│   ├── schedule_loader.py  # 加载 schedules/*.json
│   ├── script_loader.py
│   └── save_manager.py
```

设计核心思路：**静态内容按 `Case`/`NPCProfile` 分离存储（真相只在 `NPCProfile` 存一份，医疗库为其视图）、存档只存差量状态、`ResumeDocument`/`NPCProfile.medical_fields` 共用字段 key 做比对、每日规则与领导密令解耦**。后续新增应聘者或调整造假点只需加一份 `case_xxx.json` + `npc_xxx.json`，不需要改动代码逻辑。

---

## 八、当日排队队列与随机生成

为了让每天投递简历的 NPC 顺序、数量、内容都能变化，当天来的人不再由 `DailySchedule` 静态列出，而是**运行时生成**：`DailySchedule` 只保留"当天来几个人、允许什么级别、审查规则是什么"这些边界条件，具体来的是谁、什么顺序，交由工厂在进入新一天时生成一次并落存档，保证幂等可复现。

### 1. `DailyQueue`（当日排队队列）

```python
class QueueEntry(BaseModel):
    position: int                 # 当日排队顺序
    case_id: str                  # 生成后落地的Case id
    arrival_state: Literal["waiting", "in_review", "done"]  # 存档字段

class DailyQueue(BaseModel):
    day: int
    entries: list[QueueEntry]
    generated_at_seed: int | None # 生成时用的随机种子，便于复现/调试
```

### 2. `NPCFactory`（角色工厂）

负责根据当天约束随机产出 `NPCProfile`（身份 + 真实字段，定义见二、1）：

```python
class NPCFactory:
    def generate(self, schedule: DailySchedule, rng: Random) -> NPCProfile:
        # 依据 allowed_npc_levels 加权随机选级别
        # 依据当日约束（如“必须有且只有1个风险对象”）决定 is_risk_target，而非纯概率随机
        # 从有限枚举中选 archetype
        # 生成 medical_fields
        ...
```

风险对象的注入数量应由 `NPCFactory` 硬性保证（如"每天恰好 1 个"），而非纯随机导致某天可能一个风险对象都没有。

### 3. `ResumeFactory`（简历工厂）

接收 `NPCProfile`，基于其 `medical_fields`（真实值）生成一份"可能被篡改"的简历：

```python
class ResumeFactory:
    def generate(self, profile: NPCProfile, schedule: DailySchedule, rng: Random) -> ResumeDocument:
        # 以一定概率对 medical_fields 中的每个字段做篡改
        # 篡改字段的选择需参考当日 schedule.review_rules，避免规则与实际造假点错位（例如规则要求核验婚姻状况，
        # 但篡改点全落在学历上，导致玩家无解可查）
        # 若 profile.is_risk_target，则按 review_rules 针对性制造违规点
        # 生成的字段自动写 is_falsified / conflict_source
        ...
```

### 4. `ScriptMatcher`（聊天脚本匹配）

NPC 虽随机生成，但对应的聊天/视频面谈脚本**仍由策划为每个原型手写**，以保证对话质量（而非模板拼接或纯生成）。为此 `ChatScript` 增加原型标签，按标签匹配而非按 case_id 一一绑定：

```python
class ChatScript(BaseModel):
    script_id: str
    participant: Literal["boss", "npc"]
    archetype_tags: list[str]     # 适配的角色原型，如 ["intern", "honest"] / ["staff", "risk_target"]
    nodes: dict[str, DialogueNode]
    start_node_id: str

class ScriptMatcher:
    def pick(self, profile: NPCProfile, pool: list[ChatScript], rng: Random) -> str:
        tags = {profile.npc_level, profile.archetype, "risk_target" if profile.is_risk_target else "normal"}
        candidates = [s for s in pool if set(s.archetype_tags) <= tags]
        return rng.choice(candidates).script_id
```

策划按"级别 × 性格原型 × 是否风险对象"几个维度排列组合，预先写出一批有限但可复用的脚本模板（如 3 级别 × 3 性格 × 2 风险状态 ≈ 18 套），即可覆盖工厂生成的绝大多数 NPC，兼顾生成的随机性与对话内容的手工质量。

### 5. 组装流程 `DailyQueueBuilder`

生成结果统一包成一个轻量结果对象，避免调用方靠位置记住返回的裸元组是哪几项：

```python
class DailyGenerationResult(BaseModel):
    queue: DailyQueue
    cases: list[Case]
    npc_profiles: list[NPCProfile]     # 已含 medical_fields，无需再单独生成/返回 MedicalRecord

class DailyQueueBuilder:
    def build(self, schedule: DailySchedule, seed: int, script_pool: list[ChatScript]) -> DailyGenerationResult:
        rng = Random(seed)
        cases, profiles = [], []
        for i in range(schedule.npc_count):
            profile = NPCFactory().generate(schedule, rng)
            resume = ResumeFactory().generate(profile, schedule, rng)
            case = Case(
                case_id=f"case_{schedule.day}_{i}",
                npc_id=profile.npc_id,
                resume=resume,
                chat_script_id=ScriptMatcher().pick(profile, script_pool, rng),
            )
            cases.append(case)
            profiles.append(profile)
        queue = DailyQueue(
            day=schedule.day,
            entries=[QueueEntry(position=i, case_id=c.case_id, arrival_state="waiting") for i, c in enumerate(cases)],
            generated_at_seed=seed,
        )
        return DailyGenerationResult(queue=queue, cases=cases, npc_profiles=profiles)
```

生成出的 `Case` 落地为 `resources/json/cases/case_{day}_{i}.json`，`NPCProfile`（含 `medical_fields`/`medical_report_scan_url`）落地为 `resources/json/npc_profiles/npc_{id}.json`，医疗库不再单独落盘一份数据；存档中的 `DailyQueue` 只引用 case_id，保证幂等——同一 `seed` 重新生成得到完全一样的队列，便于调试与"每日种子可分享"类玩法。

### 6. 后端目录补充

```
backend/
├── services/
│   ├── npc_factory.py       # NPCFactory
│   ├── resume_factory.py    # ResumeFactory
│   ├── script_matcher.py    # ScriptMatcher
│   └── daily_queue_builder.py  # DailyQueueBuilder，组装当日队列
```

---

## 九、`GameState`：运行时全局状态

`PlayerSave` 和 `GameState` 回答的是两个不同的问题——前者是"存什么"，后者是"怎么用"，二者不是替代关系，而是配合关系。

|  | `PlayerSave` | `GameState` |
|---|---|---|
| 性质 | 持久化数据模型 | 运行时聚合对象 |
| 存在位置 | 序列化进 `save.json` | 只存在于一次请求/进程内存中，不落盘 |
| 内容 | 玩家的"差量状态"——做过什么、发现了什么、决定了什么 | 当前上下文的"全貌视图"——静态配置 + 存档 + 派生结果拼在一起 |
| 生命周期 | 跨会话持久，游戏关闭重开依然存在 | 每次请求重新构建（或短期缓存），请求结束即可丢弃 |
| 谁读它 | `save_manager.py`（唯一读写入口，负责加锁） | 各 service（`verdict_checker`、`clue_manager`、`events`）处理业务逻辑时读取 |
| 是否包含静态配置引用 | 不包含，只存 id 引用（如 `case_verdicts` 用 case_id 做 key） | 包含，直接持有 `DailySchedule`、`Case`、`SpecialDirective` 等已加载好的对象 |

### 1. 为什么需要它

后端在处理任意一个业务请求时（例如"提交对 case_003 的审核结论"），往往需要同时用到：
- `DailySchedule`（今日允许级别、审查规则）—— 静态
- `Case` + `NPCProfile`（该候选人的简历与真实信息差异）—— 静态
- `PlayerSave`（玩家已发现的线索、已收到的密令）—— 动态

如果没有统一的聚合对象，`verdict_checker.py`、`clue_manager.py` 等每个 service 都要各自调用 `schedule_loader`、`case_loader`、`npc_loader`、`save_manager` 分别读取，容易出现：
1. **不一致**：不同请求各自判断"今天是哪天"，时机不同可能得到不同结果；
2. **重复 IO**：同一次请求周期内同一份静态配置被反复加载；
3. **SSE 推送缺锚点**：`core/events.py` 判断要不要推事件（如来电提示）时，无法复用业务逻辑已经算好的状态。

### 2. 结构设计

```python
class GameState(BaseModel):
    day: int
    schedule: DailySchedule                    # 当天固定安排（从 schedules/day_N.json 加载）
    queue: DailyQueue                          # 当天排队队列（生成或从存档恢复）
    cases: dict[str, Case]                     # case_id -> Case，当天涉及的候选人
    npc_profiles: dict[str, NPCProfile]        # npc_id -> NPCProfile，配合 Case.npc_id 关联查询
    active_directives: list[SpecialDirective]  # 当前生效的特殊指令，已按 expires_day 过滤
    save: PlayerSave                           # 当前存档引用
```

`GameState` 不落盘，是`services/game_state_loader.py`在请求入口处按需构建的聚合根：

```python
state = GameState.build(day, save_manager.read())
verdict_checker.check(state, case_id="case_003", verdict="approved")
```

`verdict_checker.check()` 拿到的 `state.schedule`、`state.cases["case_003"]`、`state.npc_profiles[case.npc_id]`、`state.save.discovered_clues` 都已加载好，不需要自己决定该从哪个文件读、也不用重复加载。

### 3. 后端目录补充

```
backend/
├── services/
│   └── game_state_loader.py   # 构建/缓存 GameState，各业务 service 的统一数据入口
```

---

## 十、系统验证与错误率惩罚机制

在"当日案例逐个处理完"之后，需要一个独立的**当日结算校验环节**：汇总玩家当天所有判断的正确率，若错误率过高（含单日、连续多日、累计次数三种口径）触发相应惩罚。该环节与逐个 case 的 `verdict_checker` 判定解耦——`verdict_checker` 只负责"这一个 case 判断对不对"，本节负责"一天/多天下来整体表现如何、要不要惩罚"。

### 1. `DayResult`（当日结算结果，写入存档历史，不单独落盘）

```python
class CaseJudgement(BaseModel):
    case_id: str
    player_verdict: Literal["approved", "rejected"]
    correct_verdict: Literal["approved", "rejected"]   # verdict_checker 动态算出的标准答案
    is_correct: bool

class DayResult(BaseModel):
    day: int
    judgements: list[CaseJudgement]
    total_count: int
    error_count: int
    error_rate: float                      # error_count / total_count
    directive_results: dict[str, bool]     # directive_id -> 是否达成
    penalty_triggered: "PenaltyRecord | None"
```

### 2. `PenaltyRule`（惩罚规则配置，静态，`resources/json/penalty_rules.json`）

```python
class PenaltyAction(BaseModel):
    action_type: Literal["warning", "salary_deduction", "trigger_ending", "boss_call_scripted"]
    action_payload: dict | None            # 如 boss_call_scripted 需要 {"chat_script_id": "warning_call_01"}
    severity: int                          # 多条规则同时触发时，取最严重的一条执行

class PenaltyRule(BaseModel):
    rule_id: str
    threshold_type: Literal["single_day_error_rate", "consecutive_days", "cumulative_strikes"]
    threshold_value: float                 # 如 0.3 表示错误率超30%
    consecutive_days_required: int | None  # 仅 threshold_type=consecutive_days 时使用，如连续3天超标
    penalty_action: PenaltyAction
```

区分三种触发类型的原因：惩罚逻辑不该是单日阈值这么简单——"单日错太多"该是轻警告，"连续多天错误率高"或"累计触发次数达到上限"才该触发更严重的后果（如坏结局），这需要在规则配置层面就能表达，而非硬编码在代码里。

### 3. `PenaltyRecord`（触发记录，写入存档）

```python
class PenaltyRecord(BaseModel):
    day_triggered: int
    rule_id: str
    action: PenaltyAction
```

### 4. 存档层补充

```python
class PlayerSave(BaseModel):
    ...
    day_results: dict[int, DayResult]      # day -> 当日结算结果，用于追溯与计算 consecutive_days
    penalty_records: list[PenaltyRecord]   # 历史触发过的惩罚
    strikes: int                           # 累计违规次数，供 cumulative_strikes 类规则使用
```

`day_results` 保留完整历史（而非只留最近一天），是因为 `consecutive_days` 类规则需要回看前几天的 `error_rate` 才能判断是否连续超标；`strikes` 是从历史派生但额外持久化的计数器，避免每次判断都重新扫描全部历史。

### 5. `PenaltyChecker`（服务层）

```python
class PenaltyChecker:
    def evaluate(self, state: GameState, day_result: DayResult, rules: list[PenaltyRule]) -> PenaltyRecord | None:
        # 1. 计算 day_result.error_rate 是否触发 single_day_error_rate 规则
        # 2. 结合 state.save.day_results 回看最近N天，判断 consecutive_days 规则
        # 3. 结合 state.save.strikes 判断 cumulative_strikes 规则
        # 4. 若多条规则同时触发，按 severity 取最严重的一条执行
        ...
```

### 6. 流程衔接

接在"当日案例全部处理完"之后：`verdict_checker` 逐个算出 `CaseJudgement.is_correct` 汇总成 `DayResult` → 交给 `PenaltyChecker` 判断是否触发惩罚 → 若触发 `boss_call_scripted`，直接复用现有 `ChatScript` 机制，在第二天开局强制弹出一通警告来电，无需新增推送通道。

### 7. 后端目录补充

```
backend/
├── api/
│   └── settlement.py         # 当日结算接口，返回 DayResult + 触发的惩罚
├── services/
│   ├── day_result_builder.py # 汇总 CaseJudgement -> DayResult
│   └── penalty_checker.py    # PenaltyChecker
├── data/
│   └── penalty_rule_loader.py  # 加载 penalty_rules.json
```

---

## 十一、玩法流程

### 1. 每日开局

1. 玩家进入新一天 → 后端调用 `DailyQueueBuilder.build(schedule, seed, script_pool)`
   - 加载当天的 `DailySchedule`（`npc_count`、`allowed_npc_levels`、`review_rules`）
   - `NPCFactory` 按约束批量生成 `NPCProfile`（级别、原型、是否风险对象、真实字段）
   - `ResumeFactory` 参考当日 `review_rules` 给每份简历制造篡改点
   - `ScriptMatcher` 按 `archetype_tags` 给每个 NPC 匹配一套面谈脚本
   - 组装出 `Case[]` 落盘，`DailyQueue` 写入存档
2. 一封系统邮件自动出现在"邮箱"里，内容对应 `DailySchedule`（今天来几人、什么规则），玩家借此了解今日边界条件

### 2. 领导来电（不定期，穿插在一天任何时候）

- "聊天"软件弹出视频通话 → 加载对应 `ChatScript(participant="boss")`
- 玩家按对话树推进，某些 `DialogueNode.reveals_directive` 触发时，一条 `SpecialDirective` 被下发并写入 `save.active_directives`（例如"如果来了个隐瞒病史的，悄悄举报"）

### 3. 逐个处理 `DailyQueue` 中的候选人

对 `DailyQueue.entries` 里 `arrival_state="waiting"` 的每个 case，玩家依次：

1. **收附件**：邮箱里该 case 对应的简历附件，玩家下载到本地（`ResumeDocument.downloaded=True`），进入"档案"软件
2. **档案审查**：在档案软件查看 `ResumeDocument.fields`，可用"一键发现问题"筛出 `is_falsified=True` 的字段
3. **医疗库比对**（可选）：打开"医疗库"，按 `case.npc_id` 查询 `/api/medical/{npc_id}`（从 `NPCProfile` 投影而来），按同名 `field.key` 与简历做 diff，发现体检库与简历不符的地方 → 产出 `Clue`
4. **视频面谈**（可选）：在"聊天"软件与该 NPC 视频通话，走 `Case.chat_script_id` 对应的对话树，对话中可能进一步 `reveals_clue`
5. **提交判定**：玩家决定通过/拒绝，写入 `save.case_verdicts[case_id]`
   - 后端 `verdict_checker.py` 结合 `schedule.review_rules`、`resume vs npc_profile.medical_fields` 差异、`save.discovered_clues` 动态计算"标准答案"，校验玩家判断是否正确，产出 `CaseJudgement`
6. 若该 case 命中某条生效中的 `SpecialDirective.condition`（如确实是"隐瞒病史"的人），玩家可执行密令对应的 `action`（如举报），结果记入 `save.completed_directive_actions`，**不影响** `case_verdicts` 本身
7. `DailyQueue` 中该 entry 的 `arrival_state` 更新为 `done`，进入下一位

### 4. 一天结束：结算与惩罚

全部 `DailyQueue.entries` 处理完（或时间/次数耗尽）→ 结算当天：
1. `day_result_builder.py` 汇总当天所有 `CaseJudgement` → `DayResult`（含 `error_rate`、`directive_results`、`is_final_day`）
2. `PenaltyChecker.evaluate()` 结合当日 `error_rate`、历史 `day_results`（连续多日）、累计 `strikes`，判断是否触发 `PenaltyRule`
3. 若触发惩罚，写入 `save.penalty_records`/`strikes`；`boss_call_scripted` 类惩罚复用 `ChatScript` 机制，在第二天开局强制弹出警告来电
4. 若 `DayResult.is_final_day=False`，结算结果影响后续剧情分支（如是否被领导表扬/怀疑），进入下一天，回到 1；若为 `True`，见下节"五天流程与结局"

"每日固定安排"控制的是**边界与规则**（来多少人、什么级别、查什么），"领导密令"控制的是**穿插的隐藏任务**，"结算惩罚"控制的是**长期表现的后果**；三条线在案例处理环节（3.5-3.6）和每日结算环节（4）汇合，但各自数据互不覆盖。

---

## 十二、游戏长度与结局

游戏固定为 **5 天**，每天 `npc_count=3`，共 15 位候选人需要审查，由 `core/config.TOTAL_DAYS = 5` 统一控制，`resources/json/schedules/day_01.json` ~ `day_05.json` 五份配置逐日递增审查难度（新增字段、级别放宽/收紧、造假点更隐蔽）。

- `POST /api/day/advance` 在 `save.current_day >= TOTAL_DAYS` 时直接返回 `400`，防止越界推进到不存在的第 6 天。
- `DayResult.is_final_day`（= `day_result_builder.py` 里 `state.day >= TOTAL_DAYS`）标记"这是最后一天的结算"。
- 第 5 天结算后，前端不再弹出"进入下一天"的常规结算流程，而是展示一个**游戏结束提示窗口**，告知玩家 15 位候选人的审查工作已全部完成，游戏到此结束；不再触发下一次 `DailyQueueBuilder` 生成。


