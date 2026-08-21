#!/usr/bin/env python3
"""Start backend (FastAPI, :8000) and frontend (Next.js, :3000) together.

Usage: uv run python launch.py
Ctrl+C stops both processes.
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def require(cmd: str) -> str:
    path = shutil.which(cmd)
    if path is None:
        print(f"错误：找不到命令 `{cmd}`，请先安装。", file=sys.stderr)
        sys.exit(1)
    return path


def spawn(args: list[str], cwd: Path) -> subprocess.Popen:
    # Run each child in its own process group so we can signal the whole
    # tree (uvicorn's --reload and `npm run dev` both spawn subprocesses
    # that terminate()-ing just the parent would otherwise leave running).
    return subprocess.Popen(args, cwd=cwd, start_new_session=True)


def stop(proc: subprocess.Popen, sig: int) -> None:
    if proc.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), sig)
    except ProcessLookupError:
        pass


def main() -> None:
    uv = require("uv")
    npm = require("npm")

    processes: list[subprocess.Popen] = []
    stopping = False

    def shutdown(*_args) -> None:
        nonlocal stopping
        if stopping:
            return
        stopping = True
        print("\n正在停止服务...")
        for proc in processes:
            stop(proc, signal.SIGTERM)
        for proc in processes:
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                stop(proc, signal.SIGKILL)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print("启动后端 (FastAPI, http://localhost:8000)")
    backend = spawn(
        [uv, "run", "uvicorn", "main:app", "--reload", "--port", "8000"],
        cwd=BACKEND_DIR,
    )
    processes.append(backend)

    print("启动前端 (Next.js, http://localhost:3000)")
    frontend = spawn([npm, "run", "dev"], cwd=FRONTEND_DIR)
    processes.append(frontend)

    while True:
        for proc in processes:
            code = proc.poll()
            if code is not None and not stopping:
                print(f"进程 {proc.args} 已退出（code={code}），停止其余服务...")
                shutdown()
        try:
            backend.wait(timeout=1)
        except subprocess.TimeoutExpired:
            continue


if __name__ == "__main__":
    main()
