"""Exercise the optional WSL bridge with stubbed Windows commands; no containers."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/run-windows.sh'

class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='taskotter-windows-')
        self.root = Path(self.tmp.name)
        self.log = self.root / 'arguments.json'
        for name, code in {
            'wslpath': 'import sys\np=sys.argv[2]\nprint("C:\\\\" + p.removeprefix("/mnt/c/").replace("/", "\\\\") if p.startswith("/mnt/c/") else "C:\\\\TaskOtter\\\\scripts\\\\run-windows.ps1")',
            'powershell.exe': 'import json, os, sys\nfrom pathlib import Path\nPath(os.environ["BRIDGE_LOG"]).write_text(json.dumps(sys.argv[1:]))\nsys.exit(int(os.environ.get("BRIDGE_FAILURE", "0")))',
        }.items():
            file = self.root / name
            file.write_text('#!/usr/bin/python3\n' + code + '\n')
            file.chmod(0o755)
        self.env = {**os.environ, 'PATH': str(self.root) + os.pathsep + os.environ['PATH'], 'BRIDGE_LOG': str(self.log)}
    def tearDown(self):
        self.tmp.cleanup()
    def run_bridge(self, *args):
        return subprocess.run(['sh', str(SCRIPT), *args], cwd=self.root, env=self.env, capture_output=True, text=True)
    def test_space_and_japanese_path(self):
        result = self.run_bridge('up', '/mnt/c/Users/日本語/TaskOtter data', '4321')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(self.log.read_text())[-3:], ['up', 'C:\\Users\\日本語\\TaskOtter data', '4321'])
        self.assertIn('-File', json.loads(self.log.read_text()))
    def test_default_port(self):
        result = self.run_bridge('init', '/mnt/c/data')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(self.log.read_text())[-1], '3000')
    def test_lifecycle_commands(self):
        for action in ['build', 'stop', 'start', 'delete']:
            with self.subTest(action=action):
                self.assertEqual(self.run_bridge(action).returncode, 0)
                self.assertEqual(json.loads(self.log.read_text())[-1], action)
    def test_invalid_directory(self):
        self.assertNotEqual(self.run_bridge('up', '/home/test/data').returncode, 0)
        self.assertFalse(self.log.exists())
    def test_missing_directory(self):
        self.assertNotEqual(self.run_bridge('up').returncode, 0)
        self.assertFalse(self.log.exists())
    def test_native_failure_propagates(self):
        self.env['BRIDGE_FAILURE'] = '7'
        self.assertEqual(self.run_bridge('build').returncode, 7)

if __name__ == '__main__':
    unittest.main()
