#!/usr/bin/env python3
"""Start backend (FastAPI, :8000) and frontend (Next.js, :3000) together.

Usage: uv run python launch.py
Ctrl+C stops processes started by this launcher; existing services are reused.
"""

from __future__ import annotations

import os
import shutil
import signal
import socket
import time
from urllib.request import urlopen
import json
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


def running_project_service(port: int, cwd: Path) -> bool:
    """Reuse only a listener whose working directory is this exact project."""
    try:
        with socket.create_connection(("localhost", port), timeout=1):
            pass
    except OSError:
        return False
    try:
        result = subprocess.run(["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
                                capture_output=True, text=True, check=True, timeout=3)
        pids = set(result.stdout.split())
        if not pids:
            raise ValueError("无法识别占用进程")
        for pid in pids:
            info = subprocess.run(["lsof", "-a", "-p", pid, "-d", "cwd", "-Fn"],
                                  capture_output=True, text=True, check=True, timeout=3)
            paths = [line[1:] for line in info.stdout.splitlines() if line.startswith("n")]
            if not paths or any(Path(path).resolve() != cwd.resolve() for path in paths):
                raise ValueError("占用进程不属于当前项目")
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        raise RuntimeError(f"端口 {port} 已被占用，无法确认是本项目服务。请检查占用进程；未停止任何现有服务。") from exc
    return True


def ready(port: int) -> bool:
    try:
        path = "/api/health" if port == 8000 else "/"
        with urlopen(f"http://localhost:{port}{path}", timeout=2) as response:
            return response.status == 200 and (port != 8000 or json.load(response).get("status") == "ok")
    except (OSError, ValueError):
        return False


def main() -> None:
    # Inspect both ports before starting anything, so a conflict cannot leave
    # a partially started stack. Reused processes never belong to this launcher.
    try:
        backend_running = running_project_service(8000, BACKEND_DIR)
        frontend_running = running_project_service(3000, FRONTEND_DIR)
        if any(is_running and not ready(port) for port, is_running in
               [(8000, backend_running), (3000, frontend_running)]):
            raise RuntimeError("已有项目服务尚未就绪，请稍后重试或检查其终端日志。")
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    uv = require("uv") if not backend_running else None
    npm = require("npm") if not frontend_running else None
    processes: list[subprocess.Popen] = []
    stopping = False

    def shutdown(*_args, exit_code=0) -> None:
        nonlocal stopping
        if stopping:
            return
        stopping = True
        print("\n正在停止本次启动的服务（复用的已有服务保持运行）...")
        for proc in processes:
            stop(proc, signal.SIGTERM)
        for proc in processes:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                stop(proc, signal.SIGKILL)
                proc.wait()
        sys.exit(exit_code)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    try:
        if backend_running:
            print("后端已运行，复用 http://localhost:8000")
        else:
            print("启动后端 (FastAPI, http://localhost:8000)")
            processes.append(spawn([uv, "run", "uvicorn", "main:app", "--reload", "--port", "8000", "--timeout-graceful-shutdown", "2"], BACKEND_DIR))
        if frontend_running:
            print("前端已运行，复用 http://localhost:3000")
        else:
            print("启动前端 (Next.js, http://localhost:3000)")
            processes.append(spawn([npm, "run", "dev", "--", "--port", "3000"], FRONTEND_DIR))
        deadline = time.monotonic() + 30
        while not (ready(8000) and ready(3000)):
            if any(proc.poll() is not None for proc in processes):
                print("服务启动失败，请查看上方日志。", file=sys.stderr)
                shutdown(exit_code=1)
            if time.monotonic() >= deadline:
                print("服务启动超时，请查看上方日志。", file=sys.stderr)
                shutdown(exit_code=1)
            time.sleep(.5)
        print("游戏已就绪：http://localhost:3000")
        if not processes:
            print("前后端均已运行，无需重复启动。")
            return
        while True:
            for proc in processes:
                if proc.poll() is not None:
                    print(f"服务已退出（code={proc.returncode}），停止本次启动的其他服务。")
                    shutdown(exit_code=1)
            time.sleep(1)
    except OSError as exc:
        print(f"启动失败：{exc}", file=sys.stderr)
        shutdown(exit_code=1)


if __name__ == "__main__":
    main()
