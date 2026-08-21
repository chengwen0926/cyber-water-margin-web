# 视觉风格
采用 Apple 早期 Macintosh 页面风格

# 《赛博水浒入职日》本地Web端架构设计文档

## 一、 架构概述

本项目采用 **轻量级前后端分离** 架构，专为本地单机剧情解谜游戏设计。舍弃了复杂的网关、线上并发控制和大型数据库配置，专注于核心叙事逻辑与UI交互体验。

*   **前端展示层**: Next.js (React)
    *   负责高频UI交互（拖拽、界面切换、弹窗动画）。
    *   组件化管理虚拟桌面、邮件客户端、视频通话等“游戏内软件”。
*   **后端逻辑层**: FastAPI (Python)
    *   负责状态机流转、条件判定与游戏存档控制。
    *   提供RESTful接口供前端调用，并通过SSE/WebSocket处理被动事件推送。
*   **数据持久层**: 本地 `.json` 文件
    *   `script.json`: 存储静态剧本、节点配置、台词。
    *   `save.json`: 存储玩家进度、已解锁线索、状态标记。

---

## 二、 后端目录架构设计

为了保证项目后期的可维护性，建议对 FastAPI 应用进行清晰的模块化拆分。以下是推荐的后端目录层级：

```text
backend/
├── main.py                  # FastAPI 应用入口与实例初始化
├── api/                     # 路由层 (Routers)
│   ├── email.py             # 虚拟邮件系统接口
│   ├── database.py          # 医疗/档案数据库查询接口
│   └── dialogue.py          # 剧情节点与对话触发接口
├── core/                    # 核心配置与工具
│   ├── config.py            # 全局配置加载
│   └── events.py            # WebSocket/SSE 连接与事件管理
├── services/                # 业务逻辑层
│   ├── state_machine.py     # 游戏进度与状态校验逻辑
│   └── clue_manager.py      # 线索合成与词条更新逻辑
├── data/                    # JSON 数据访问层
│   ├── script_loader.py     # script.json 读取器
│   └── save_manager.py      # save.json 读写控制器 (含文件锁逻辑)
└── resources/               # 静态文件
    ├── json/
    │   ├── script.json      # 剧本与节点配置
    │   └── save.json        # 玩家进度存档
    └── assets/              # 附件原件、头像等静态资源
```

---

## 三、 核心机制实现方案

### 1. 数据持久化与并发安全控制
由于游戏将所有状态存储在本地 `.json` 文件中，前端可能会在极短时间内发起多个状态更新请求（例如连续拖拽线索）。
*   **实现方案**: 在 `save_manager.py` 中引入 `portalocker` 库实现跨平台的文件锁。在每次更新玩家存档（读取-修改-写入）时，对 `save.json` 加排他锁，确保同一时间只有一个请求能修改存档，避免并发写入导致文件损坏或进度丢失。

### 2. 状态机与节点触发机制
后端作为游戏的裁判，需要严格校验玩家的行为是否合法。
*   **剧本数据结构 (`script.json`)**:
    ```json
    {
      "nodes": {
        "dialogue_wusong_01": {
          "trigger_type": "drag_clue",
          "required_clue": "photo_unclear",
          "required_state": "task_received",
          "content": "什么！你不喜欢我的照片吗？啊？必须要露出正脸吗，我还以为说的是这个玩偶的正脸......",
          "unlocks": {
            "new_clues": ["photo_fake"],
            "state_update": "wusong_questioned_1"
          }
        }
      }
    }
    ```
*   **逻辑流转**: 前端向 `/api/dialogue/trigger` 发送当前动作，后端在 `services/state_machine.py` 中比对当前 `save.json`，若满足 `required_state`，则返回 `content` 并更新存档。

### 3. 被动事件推送 (服务器 -> 客户端)
流程图中包含“工作邮箱消息提示”和“视频通话软件弹窗”（如高俅突然发起的通话）。
*   **实现方案**: 在 FastAPI 中使用 SSE (Server-Sent Events) 机制。
    *   前端 Next.js 在全局布局 (Layout) 中建立一个 `EventSource` 监听后端的推送端点。
    *   后端在判定到达特定剧情节点时，通过 SSE 通道下发事件类型 `{"event": "incoming_call", "caller": "gaoqiu"}`。
    *   前端捕获事件后，触发相应的全屏弹窗或系统通知 UI。

---

## 四、 总结

这套“FastAPI + Next.js + 纯本地 JSON 存储”的架构去除了冗余的基础设施，极其适合《赛博水浒入职日》这类偏叙事和交互的轻量级单机 Web 游戏。通过合理的目录拆分与 `portalocker` 文件锁机制，既能保证代码逻辑的清晰，又能确保游戏数据的绝对安全。
