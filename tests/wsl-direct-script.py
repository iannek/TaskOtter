"""Portable launcher contract tests; no network or system installation."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/run-wsl-direct.sh'

class DirectScriptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.bin = self.base / 'bin'
        self.bin.mkdir()
        self.runtime = self.base / '専用 runtime'
        self.log = self.base / 'calls.jsonl'
        self.env = dict(os.environ, TASKOTTER_RUNTIME_DIR=str(self.runtime),
                        TEST_LOG=str(self.log), PATH=str(self.bin)+':'+os.environ['PATH'])
        self.arch = 'arm64' if os.uname().machine in ('aarch64', 'arm64') else 'x64'
        self.folder = f'node-v24.21.0-linux-{self.arch}'
        self.archive = self.base / (self.folder + '.tar.xz')
        node = b'''#!/usr/bin/env python3
import os,sys,json
if sys.argv[1:] == ['--version']: print('v24.21.0')
else:
 with open(os.environ['TEST_LOG'],'a') as f: f.write(json.dumps({'args':sys.argv[1:],'cwd':os.getcwd(),'data':os.getenv('DATA_DIR'),'host':os.getenv('HOST'),'port':os.getenv('PORT')})+'\\n')
'''
        npm = b'''#!/usr/bin/env python3
import os,sys,json
with open(os.environ['TEST_LOG'],'a') as f: f.write(json.dumps({'args':sys.argv[1:],'cwd':os.getcwd(),'cache':os.getenv('npm_config_cache')})+'\\n')
if 'audit' in sys.argv and os.getenv('FAIL_AUDIT'): sys.exit(7)
'''
        with tarfile.open(self.archive, 'w:xz') as archive:
            for name, content in [('node', node), ('npm', npm)]:
                member = tarfile.TarInfo(self.folder+'/bin/'+name)
                member.size = len(content)
                member.mode = 0o755
                archive.addfile(member, io.BytesIO(content))
        self.env['TEST_ARCHIVE'] = str(self.archive)
        curl = self.bin / 'curl'
        curl.write_text('''#!/usr/bin/env python3
import sys,os,hashlib,pathlib,shutil
source=pathlib.Path(os.environ['TEST_ARCHIVE']); target=pathlib.Path(sys.argv[sys.argv.index('-o')+1])
if target.name == 'SHASUMS256.txt':
 digest='0'*64 if os.getenv('BAD_CHECKSUM') else hashlib.sha256(source.read_bytes()).hexdigest()
 target.write_text(digest+'  '+source.name+'\\n')
else: shutil.copyfile(source,target)
''')
        curl.chmod(0o755)

    def run_script(self, *args, ok=True):
        result = subprocess.run(['sh', str(SCRIPT), *args], cwd=self.base,
                                env=self.env, text=True, capture_output=True)
        if ok: self.assertEqual(result.returncode, 0, result.stderr)
        else: self.assertNotEqual(result.returncode, 0)
        return result

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_setup_checksum_and_reuse(self):
        self.run_script('setup')
        self.assertTrue((self.runtime/self.folder/'bin/node').is_file())
        self.assertEqual(list(self.runtime.glob('.download.*')), [])
        self.archive.unlink()  # Existing runtime must not download again.
        self.run_script('setup')

    def test_checksum_failure_does_not_install(self):
        self.env['BAD_CHECKSUM'] = '1'
        self.run_script('setup', ok=False)
        self.assertFalse((self.runtime/self.folder).exists())
        self.assertEqual(list(self.runtime.glob('.download.*')), [])

    def test_build_order_and_cache(self):
        self.run_script('setup')
        self.run_script('build')
        calls = self.calls()
        self.assertEqual([c['args'] for c in calls], [['ci','--ignore-scripts'], ['audit'], ['run','check'], ['run','build']])
        self.assertTrue(all(c['cwd'] == str(ROOT) for c in calls))
        self.assertTrue(all(c['cache'] == str(self.runtime/'npm-cache') for c in calls))

    def test_audit_failure_stops_build(self):
        self.run_script('setup')
        self.env['FAIL_AUDIT'] = '1'
        result = self.run_script('build', ok=False)
        self.assertEqual(result.returncode, 7)
        self.assertEqual(len(self.calls()), 2)

    def test_init_and_start_paths(self):
        self.run_script('setup')
        self.run_script('init', '保存先 [test]')
        self.run_script('start', '保存先 [test]', '3001')
        init, start = self.calls()
        self.assertEqual(init['args'], ['dist/server/init.js'])
        self.assertEqual(start['args'], ['dist/server/main.js'])
        self.assertEqual(start['data'], str(self.base/'保存先 [test]'))
        self.assertEqual(start['cwd'], str(ROOT))
        self.assertEqual((start['host'], start['port']), ('127.0.0.1','3001'))
        self.run_script('start', '保存先 [test]')
        self.assertEqual(self.calls()[-1]['port'], '3000')

    def test_invalid_args_do_not_create_data(self):
        self.run_script('setup')
        for args in [('start',), ('init',''), ('start','invalid','0'), ('start','invalid','65536'), ('start','invalid','abc'), ('setup','extra')]:
            self.run_script(*args, ok=False)
        self.assertFalse((self.base/'invalid').exists())
        self.assertFalse(self.log.exists())

    def test_missing_runtime_and_relative_runtime(self):
        self.run_script('build', ok=False)
        self.env['TASKOTTER_RUNTIME_DIR'] = 'relative'
        self.run_script('setup', ok=False)
        self.assertFalse((self.base/'relative').exists())

if __name__ == '__main__': unittest.main()
