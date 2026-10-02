"""Test Docker launcher argument and failure handling without a real Docker daemon."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

PROJECT = Path(__file__).resolve().parents[1]
SCRIPT = PROJECT / 'scripts/run-wsl-docker.sh'

class DockerScriptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='taskotter-docker-test-')
        self.root = Path(self.tmp.name)
        self.log = self.root / 'calls.jsonl'
        docker = self.root / 'docker'
        docker.write_text('''#!/usr/bin/python3
import json, os, sys
with open(os.environ['DOCKER_TEST_LOG'], 'a') as f:
    f.write(json.dumps(sys.argv[1:]) + '\\n')
sys.exit(int(os.environ.get('DOCKER_TEST_FAILURE', '0')))
''')
        docker.chmod(0o755)
        sudo = self.root / 'sudo'
        sudo.write_text('''#!/usr/bin/python3
import os, sys
from pathlib import Path
Path(os.environ['DOCKER_TEST_SUDO']).write_text('called')
os.execvp(sys.argv[1], sys.argv[1:])
''')
        sudo.chmod(0o755)
        self.env = {**os.environ, 'PATH': str(self.root) + os.pathsep + os.environ['PATH'], 'DOCKER_TEST_LOG': str(self.log), 'DOCKER_TEST_SUDO': str(self.root / 'sudo-marker'), 'TASKOTTER_DOCKER_SUDO': '0'}
    def tearDown(self):
        self.tmp.cleanup()
    def run_script(self, *args):
        return subprocess.run(['sh', str(SCRIPT), *args], cwd=self.root, env=self.env, capture_output=True, text=True)
    def last_call(self):
        return json.loads(self.log.read_text().splitlines()[-1])
    def test_build_uses_project_context_from_other_directory(self):
        result = self.run_script('build'); self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.last_call(), ['build', '-f', str(PROJECT / 'Containerfile'), '-t', 'taskotter:local', str(PROJECT)])
    def test_init_handles_literal_unicode_spaces_and_relative_directory(self):
        result = self.run_script('init', '日本語 [data]/TaskOtter data'); self.assertEqual(result.returncode, 0, result.stderr)
        args = self.last_call(); self.assertIn(f'{self.root}/日本語 [data]/TaskOtter data:/data', args)
        self.assertIn(f'{os.getuid()}:{os.getgid()}', args); self.assertIn('await new Store("/data").initialize();', args[-1])
    def test_up_uses_loopback_and_custom_port(self):
        result = self.run_script('up', str(self.root / 'data'), '4321'); self.assertEqual(result.returncode, 0, result.stderr)
        args = self.last_call(); self.assertIn('127.0.0.1:4321:3000', args); self.assertIn('taskotter-docker', args)
        self.assertIn(f'{os.getuid()}:{os.getgid()}', args)
    def test_default_port_and_optional_sudo(self):
        self.env['TASKOTTER_DOCKER_SUDO'] = '1'
        result = self.run_script('up', str(self.root / 'data')); self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('127.0.0.1:3000:3000', self.last_call()); self.assertTrue((self.root / 'sudo-marker').exists())
    def test_invalid_arguments_do_not_run_docker_or_create_data(self):
        for args in [('up',), ('unknown',), ('up', 'data', '0'), ('up', 'data', '65536'), ('up', 'data', 'abc'), ('up', 'data', '999999999999999')]:
            with self.subTest(args=args): self.assertNotEqual(self.run_script(*args).returncode, 0)
        self.assertFalse(self.log.exists()); self.assertFalse((self.root / 'data').exists())
    def test_lifecycle_and_delete_preserve_data(self):
        data = self.root / 'data'; data.mkdir(); file = data / 'taskotter.json'; file.write_text('existing data')
        for action in ['stop', 'start', 'delete', 'logs', 'status']:
            with self.subTest(action=action): self.assertEqual(self.run_script(action).returncode, 0)
        self.assertEqual(file.read_text(), 'existing data')
    def test_native_failure_does_not_announce_success(self):
        self.env['DOCKER_TEST_FAILURE'] = '7'
        result = self.run_script('up', str(self.root / 'data')); self.assertEqual(result.returncode, 7); self.assertNotIn('http://localhost', result.stdout)
    def test_file_is_not_accepted_as_directory(self):
        file = self.root / 'file'; file.write_text('keep')
        self.assertNotEqual(self.run_script('up', str(file)).returncode, 0); self.assertFalse(self.log.exists()); self.assertEqual(file.read_text(), 'keep')

if __name__ == '__main__':
    unittest.main()
