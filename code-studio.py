#!/usr/bin/env python3
"""Code Studio — local runner for the competitive programming studio.

Detects installed toolchains, compiles/runs code against test cases, and
persists workspace files. Serves the UI (code-studio.html) on localhost.
Stdlib only; nothing to install.

Usage:  python3 code-studio.py [workspace-dir]
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from urllib.request import urlopen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.realpath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, 'code-workspace')
HTML_PATH = os.path.join(HERE, 'code-studio.html')
TOKEN = uuid.uuid4().hex
PORTS = list(range(8137, 8147))

# Apple clang lacks <bits/stdc++.h>; ship a shim so CP code compiles unmodified.
SHIM_DIR = os.path.join(HERE, '.cs-include')
_SHIM_HEADERS = ['algorithm', 'array', 'bitset', 'cassert', 'cctype', 'chrono', 'cmath',
                 'complex', 'cstdint', 'cstdio', 'cstdlib', 'cstring', 'deque', 'functional',
                 'iomanip', 'iostream', 'iterator', 'limits', 'map', 'numeric', 'queue',
                 'random', 'set', 'sstream', 'stack', 'string', 'tuple', 'unordered_map',
                 'unordered_set', 'utility', 'vector']


def ensure_shim():
    path = os.path.join(SHIM_DIR, 'bits', 'stdc++.h')
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            f.write('#pragma once\n' + ''.join('#include <%s>\n' % h for h in _SHIM_HEADERS))


LANGS = {
    'cpp': {
        'name': 'C++ (g++ -std=c++17 -O2)', 'tool': 'g++', 'file': 'main.cpp',
        'compile': lambda d: ['g++', '-std=c++17', '-O2', '-I', SHIM_DIR, '-o', os.path.join(d, 'exe'), os.path.join(d, 'main.cpp')],
        'run': lambda d: [os.path.join(d, 'exe')],
    },
    'c': {
        'name': 'C (gcc -std=c11 -O2)', 'tool': 'gcc', 'file': 'main.c',
        'compile': lambda d: ['gcc', '-std=c11', '-O2', '-o', os.path.join(d, 'exe'), os.path.join(d, 'main.c')],
        'run': lambda d: [os.path.join(d, 'exe')],
    },
    'python': {
        'name': 'Python 3', 'tool': 'python3', 'file': 'main.py',
        'compile': None,
        'run': lambda d: ['python3', os.path.join(d, 'main.py')],
    },
    'node': {
        'name': 'JavaScript (Node)', 'tool': 'node', 'file': 'main.js',
        'compile': None,
        'run': lambda d: ['node', os.path.join(d, 'main.js')],
    },
    'java': {
        'name': 'Java', 'tool': 'javac', 'file': 'Main.java',
        'compile': lambda d: ['javac', '-d', d, os.path.join(d, 'Main.java')],
        'run': lambda d: ['java', '-cp', d, 'Main'],
    },
    'go': {
        'name': 'Go', 'tool': 'go', 'file': 'main.go',
        'compile': lambda d: ['go', 'build', '-o', os.path.join(d, 'exe'), os.path.join(d, 'main.go')],
        'run': lambda d: [os.path.join(d, 'exe')],
    },
    'rust': {
        'name': 'Rust (rustc -O)', 'tool': 'rustc', 'file': 'main.rs',
        'compile': lambda d: ['rustc', '-O', '-o', os.path.join(d, 'exe'), os.path.join(d, 'main.rs')],
        'run': lambda d: [os.path.join(d, 'exe')],
    },
}


def detect_languages():
    out = []
    for lang_id, spec in LANGS.items():
        path = shutil.which(spec['tool'])
        if not path:
            continue
        try:
            r = subprocess.run([spec['tool'], '--version'], capture_output=True, text=True,
                               errors='replace', timeout=10)
            # macOS ships stub binaries (e.g. javac) that exist but error out
            if r.returncode != 0:
                continue
            version = (r.stdout or r.stderr).strip().splitlines()[0][:80]
        except Exception:
            continue
        out.append({'id': lang_id, 'name': spec['name'], 'version': version})
    return out


def run_code(payload):
    spec = LANGS.get(payload.get('lang'))
    if not spec:
        return {'error': 'unknown language'}
    if not shutil.which(spec['tool']):
        return {'error': spec['tool'] + ' is not installed'}
    tests = payload.get('tests') or [{'input': ''}]
    limit = min(max(int(payload.get('timeLimit', 2000)), 100), 20000) / 1000.0
    tmp = tempfile.mkdtemp(prefix='code-studio-')
    try:
        with open(os.path.join(tmp, spec['file']), 'w') as f:
            f.write(payload.get('code', ''))
        if spec['compile']:
            try:
                r = subprocess.run(spec['compile'](tmp), capture_output=True, text=True,
                                   errors='replace', timeout=40)
            except subprocess.TimeoutExpired:
                return {'compileError': 'compiler timed out (40 s)'}
            if r.returncode != 0:
                return {'compileError': (r.stderr or r.stdout)[:20000]}
        results = []
        for t in tests:
            start = time.perf_counter()
            try:
                r = subprocess.run(spec['run'](tmp), input=t.get('input', ''), capture_output=True,
                                   text=True, errors='replace', timeout=limit, cwd=tmp)
                ms = round((time.perf_counter() - start) * 1000)
                results.append({
                    'verdict': 'RE' if r.returncode != 0 else 'OK',
                    'stdout': r.stdout[:100000],
                    'stderr': r.stderr[:20000],
                    'timeMs': ms,
                    'exitCode': r.returncode,
                })
            except subprocess.TimeoutExpired:
                results.append({'verdict': 'TLE', 'stdout': '', 'stderr': '',
                                'timeMs': round(limit * 1000), 'exitCode': None})
        return {'results': results}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------- workspace files ----------
def safe_path(rel):
    p = os.path.realpath(os.path.join(ROOT, rel.strip('/')))
    if p != ROOT and not p.startswith(ROOT + os.sep):
        raise ValueError('path escapes workspace')
    return p


def tree():
    items = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        rel = os.path.relpath(dirpath, ROOT)
        base = '' if rel == '.' else rel.replace(os.sep, '/')
        for d in dirnames:
            items.append({'path': (base + '/' + d).lstrip('/'), 'kind': 'dir'})
        for f in filenames:
            if f.startswith('.'):
                continue
            items.append({'path': (base + '/' + f).lstrip('/'), 'kind': 'file'})
    return items


SAMPLE = """#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int a, b;
    cin >> a >> b;
    cout << a + b << "\\n";
    return 0;
}
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self):
        if self.headers.get('X-Token') == TOKEN:
            return True
        self._json({'error': 'bad token'}, 403)
        return False

    def _payload(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'{}')

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == '/' or url.path == '/index.html':
            try:
                with open(HTML_PATH, encoding='utf-8') as f:
                    html = f.read().replace('__TOKEN__', TOKEN)
            except OSError:
                self._json({'error': 'code-studio.html not found next to code-studio.py'}, 500)
                return
            body = html.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif url.path == '/api/ping':
            self._json({'app': 'code-studio'})
        elif url.path == '/api/languages':
            if self._authed():
                self._json({'languages': detect_languages()})
        elif url.path == '/api/tree':
            if self._authed():
                self._json({'root': os.path.basename(ROOT) or ROOT, 'items': tree()})
        elif url.path == '/api/file':
            if self._authed():
                try:
                    rel = parse_qs(url.query).get('path', [''])[0]
                    with open(safe_path(rel), encoding='utf-8', errors='replace') as f:
                        self._json({'content': f.read()})
                except (OSError, ValueError) as e:
                    self._json({'error': str(e)}, 400)
        else:
            self._json({'error': 'not found'}, 404)

    def do_POST(self):
        url = urlparse(self.path)
        if not self._authed():
            return
        try:
            p = self._payload()
            if url.path == '/api/run':
                self._json(run_code(p))
            elif url.path == '/api/file':
                target = safe_path(p['path'])
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, 'w', encoding='utf-8') as f:
                    f.write(p.get('content', ''))
                self._json({'ok': True})
            elif url.path == '/api/mkdir':
                os.makedirs(safe_path(p['path']), exist_ok=True)
                self._json({'ok': True})
            elif url.path == '/api/rename':
                src, dst = safe_path(p['from']), safe_path(p['to'])
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                os.rename(src, dst)
                self._json({'ok': True})
            elif url.path == '/api/delete':
                target = safe_path(p['path'])
                if os.path.isdir(target):
                    shutil.rmtree(target)
                else:
                    os.remove(target)
                self._json({'ok': True})
            else:
                self._json({'error': 'not found'}, 404)
        except (OSError, ValueError, KeyError, json.JSONDecodeError) as e:
            self._json({'error': str(e)}, 400)


def main():
    os.makedirs(ROOT, exist_ok=True)
    ensure_shim()
    sample = os.path.join(ROOT, 'welcome.cpp')
    if not os.listdir(ROOT):
        with open(sample, 'w') as f:
            f.write(SAMPLE)
    for port in PORTS:
        # already running? just open the browser
        try:
            with urlopen('http://127.0.0.1:%d/api/ping' % port, timeout=0.4) as r:
                if json.load(r).get('app') == 'code-studio':
                    print('Code Studio already running on port %d — opening browser.' % port)
                    webbrowser.open('http://127.0.0.1:%d/' % port)
                    return
        except Exception:
            pass
        try:
            server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
        except OSError:
            continue
        url = 'http://127.0.0.1:%d/' % port
        print('Code Studio  →  %s' % url)
        print('Workspace    →  %s' % ROOT)
        print('Press Ctrl+C to stop.')
        threading.Timer(0.6, webbrowser.open, [url]).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')
        return
    print('No free port in %s' % PORTS)


if __name__ == '__main__':
    main()
