"""Regression tests for code-studio.py (issues #1 and #2). Run: python -m unittest tests.test_code_studio"""
import http.client, json, os, re, subprocess, sys, tempfile, time, unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class CodeStudio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ws = tempfile.mkdtemp()
        open(os.path.join(cls.ws, 'keep.cpp'), 'w').close()
        cls.proc = subprocess.Popen([sys.executable, os.path.join(HERE, 'code-studio.py'), cls.ws],
                                    stdout=subprocess.PIPE, text=True,
                                    env={**os.environ, 'BROWSER': 'true', 'PYTHONUNBUFFERED': '1'})
        line = ''
        while 'http://' not in line:
            line = cls.proc.stdout.readline()
        cls.port = int(re.search(r':(\d+)/', line).group(1))
        cls.tok = cls._req('GET', '/')[1].decode()
        cls.tok = re.search(r'[0-9a-f]{32}', cls.tok).group(0)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()

    @classmethod
    def _req(cls, method, path, body=None, headers=None):
        h = {'Host': '127.0.0.1:%d' % cls.port}
        h.update(headers or {})
        c = http.client.HTTPConnection('127.0.0.1', cls.port)
        c.request(method, path, body, h)
        r = c.getresponse()
        return r.status, r.read()

    def test_foreign_host_rejected(self):
        self.assertEqual(self._req('GET', '/', headers={'Host': 'evil.example:%d' % self.port})[0], 403)
        st, _ = self._req('POST', '/api/run', json.dumps({'tests': [{'input': ''}], 'lang': 'python', 'code': ''}),
                          {'Host': 'evil.example:%d' % self.port, 'X-Token': self.tok})
        self.assertEqual(st, 403)

    def test_foreign_origin_rejected(self):
        st, _ = self._req('POST', '/api/mkdir', json.dumps({'path': 'x'}),
                          {'Origin': 'http://evil.example', 'X-Token': self.tok})
        self.assertEqual(st, 403)

    def test_localhost_ok(self):
        self.assertEqual(self._req('GET', '/api/tree', headers={'X-Token': self.tok})[0], 200)
        self.assertEqual(self._req('GET', '/', headers={'Host': 'localhost:%d' % self.port})[0], 200)

    def test_root_not_deletable(self):
        for path in ('', '/', '.'):
            st, _ = self._req('POST', '/api/delete', json.dumps({'path': path}), {'X-Token': self.tok})
            self.assertEqual(st, 400)
        st, _ = self._req('POST', '/api/rename', json.dumps({'from': '', 'to': 'y'}), {'X-Token': self.tok})
        self.assertEqual(st, 400)
        self.assertTrue(os.path.exists(os.path.join(self.ws, 'keep.cpp')))


if __name__ == '__main__':
    unittest.main()
