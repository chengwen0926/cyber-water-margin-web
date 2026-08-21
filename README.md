# 赛博水浒入职日

本地单机 HR 审查模拟游戏。前端 Next.js（像素风 Macintosh 桌面），后端 FastAPI，数据以本地 JSON 文件持久化。详见 `specs/specs.md` 与 `specs/design.md`。

## 开发环境

一键启动（同时拉起前后端，Ctrl+C 一并停止）：

```bash
uv run python launch.py
```

或分别在两个终端启动：

```bash
# 终端 1：后端 (FastAPI, http://localhost:8000)
cd backend
uv run uvicorn main:app --reload --port 8000

# 终端 2：前端 (Next.js, http://localhost:3000)
cd frontend
npm run dev
```

前端通过 `NEXT_PUBLIC_API_BASE_URL` 环境变量指向后端地址，默认 `http://localhost:8000`（可复制 `frontend/.env.local.example` 为 `frontend/.env.local` 自定义）。

## 后端测试

```bash
cd backend
uv run pytest
```

## 游戏流程

1. 登录（装饰性，无真实鉴权）
2. 点击菜单栏「进入下一天」生成当日候选人队列
3. 在「邮箱」下载简历附件 → 进入「档案」
4. 在「档案」查看简历字段、使用「一键发现问题」、提交通过/拒绝判定
5. 在「医疗库」查看体检原件、与简历比对
6. 在「聊天」与领导/候选人对话，处理领导下达的特殊密令
7. 点击「结束今天」触发当日结算与惩罚判定
