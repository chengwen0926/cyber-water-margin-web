import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch
from types import SimpleNamespace
import pytest

spec = importlib.util.spec_from_file_location('project_launcher', Path(__file__).parents[2] / 'launch.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


def test_free_port_needs_start():
    with patch.object(launcher.socket, 'create_connection', side_effect=ConnectionRefusedError):
        assert not launcher.running_project_service(8000, launcher.BACKEND_DIR)


def test_existing_matching_service_is_reused():
    with patch.object(launcher.socket, 'create_connection', return_value=MagicMock()), patch.object(launcher.subprocess, 'run', side_effect=[SimpleNamespace(stdout='123\n'), SimpleNamespace(stdout=f'p123\nfcwd\nn{launcher.BACKEND_DIR}\n')]):
        assert launcher.running_project_service(8000, launcher.BACKEND_DIR)


def test_foreign_service_is_not_reused():
    with patch.object(launcher.socket, 'create_connection', return_value=MagicMock()), patch.object(launcher.subprocess, 'run', side_effect=[SimpleNamespace(stdout='123\n'), SimpleNamespace(stdout='p123\nfcwd\nn/another-project\n')]):
        with pytest.raises(RuntimeError, match='端口 8000'):
            launcher.running_project_service(8000, launcher.BACKEND_DIR)


def test_both_running_does_not_spawn_or_require_commands():
    with patch.object(launcher, 'running_project_service', return_value=True), patch.object(launcher, 'ready', return_value=True), patch.object(launcher, 'spawn') as spawn, patch.object(launcher, 'require') as require, patch.object(launcher.signal, 'signal'):
        launcher.main()
        spawn.assert_not_called()
        require.assert_not_called()
