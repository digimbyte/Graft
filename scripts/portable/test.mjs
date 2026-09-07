// Integration test against the packaged runtime, with no Node/npm/compiler on PATH.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stage = resolve(process.argv[2] || join(root, '.portable', `graft-${process.platform}-${process.arch}`));
const runtime = join(stage, process.platform === 'win32' ? 'node.exe' : 'node');
const fixture = mkdtempSync(join(tmpdir(), 'graft-portable-'));
const git = process.platform === 'win32'
  ? execFileSync('where.exe', ['git.exe'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
  : execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
const cleanPath = process.platform === 'win32'
  ? `${process.env.SystemRoot}\\System32;${process.env.SystemRoot};${dirname(git)}`
  : '/usr/bin:/bin';
const env = { ...process.env, PATH: cleanPath, DO_NOT_TRACK: '1' };
delete env.NODE_PATH;
delete env.NODE_OPTIONS;
const children = [];
function client(cwd) {
  const child = spawn(runtime, [join(stage, 'app/scripts/portable/mcp.mjs')], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  children.push(child);
  let stderr = '', next = 1;
  const pending = new Map();
  child.stderr.on('data', (b) => { stderr += b; });
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line); // any stdout diagnostic fails the test
    const callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); callback(message); }
  });
  return {
    async request(method, params = {}) {
      const id = next++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout: ${method}\n${stderr}`)), 120_000);
        pending.set(id, (message) => { clearTimeout(timer); resolve(message); });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    async tool(name, args = {}) {
      const message = await this.request('tools/call', { name, arguments: args });
      assert.ok(!message.error, JSON.stringify(message));
      assert.equal(message.result.isError, false, JSON.stringify(message));
      return message.result.content.map((c) => c.text).join('\n');
    },
    close() { child.stdin.end(); },
  };
}
try {
  const repo = join(fixture, 'repo');
  mkdirSync(join(repo, 'src'), { recursive: true });
  execFileSync(git, ['init', '-q', repo]);
  const source = 'export function add(a: number, b: number): number { return a + b; }\nexport function total(): number { return add(1, 2); }\n';
  writeFileSync(join(repo, 'src/math.ts'), source);
  // Native depth parsers and WASM breadth parsers all load from the shipped tree.
  for (const [file, text] of Object.entries({
    'example.py': 'def python_probe(x):\n    return x + 1\n',
    'example.go': 'package example\nfunc GoProbe(x int) int { return x + 1 }\n',
    'Example.java': 'class Example { int javaProbe(int x) { return x + 1; } }\n',
    'example.rs': 'pub fn rust_probe(x: usize) -> usize { x + 1 }\n',
    'example.rb': 'def ruby_probe(x)\n  x + 1\nend\n',
    'example.c': 'int c_probe(int x) { return x + 1; }\n',
    'example.cpp': 'int cpp_probe(int x) { return x + 1; }\n',
    'example.php': '<?php function php_probe($x) { return $x + 1; }\n',
    'example.js': 'export function js_probe(x) { return x + 1; }\n',
    'example.kt': 'fun kotlin_probe(x: Int): Int { return x + 1 }\n',
    'example.swift': 'func swift_probe(_ x: Int) -> Int { return x + 1 }\n',
    'example.r': 'r_probe <- function(x) { x + 1 }\n',
  })) writeFileSync(join(repo, 'src', file), text);
  writeFileSync(join(repo, '.gitignore'), 'graft/\n');
  writeFileSync(join(repo, 'AGENTS.md'), 'Preserve this file.\n');
  execFileSync(git, ['-C', repo, 'add', '.']);
  execFileSync(git, ['-C', repo, '-c', 'user.name=Portable test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture']);

  const a = client(join(repo, 'src'));
  const b = client(repo);
  // Queue initialization before indexing is finished, and race two first starts.
  const initialized = await Promise.all([a.request('initialize'), b.request('initialize')]);
  for (const response of initialized) assert.equal(response.result.serverInfo.name, 'graft');
  const listed = await a.request('tools/list');
  assert.equal(listed.result.tools.length, 6);
  assert.match(await a.tool('graft_find_code', { query: 'add' }), /add/);
  assert.match(await a.tool('graft_file_api', { file: 'src/math.ts' }), /total/);
  assert.match(await a.tool('graft_trace_calls', { symbol: 'add' }), /total/);
  assert.match(await a.tool('graft_find_all', { pattern: 'return add', fixed: true }), /math.ts/);
  assert.ok((await a.tool('graft_repo_map')).length > 0);
  await a.tool('graft_check_freshness');
  for (const file of ['example.py', 'example.go', 'Example.java', 'example.rs', 'example.rb', 'example.c', 'example.cpp', 'example.php', 'example.js', 'example.kt', 'example.swift', 'example.r']) {
    const api = await a.tool('graft_file_api', { file: `src/${file}` });
    assert.match(api, /[Pp]robe/, `${file} parser missing: ${api}`);
  }
  writeFileSync(join(repo, 'src/math.ts'), source + 'export function refreshed(): number { return add(3, 4); }\n');
  assert.match(await a.tool('graft_file_api', { file: 'src/math.ts' }), /refreshed/);
  assert.equal(readFileSync(join(repo, 'AGENTS.md'), 'utf8'), 'Preserve this file.\n');
  assert.equal(readFileSync(join(repo, '.gitignore'), 'utf8'), 'graft/\n');
  assert.equal(existsSync(join(repo, '.mcp.json')), false);
  assert.equal(existsSync(join(repo, 'src/graft')), false);
  a.close(); b.close();

  const worktree = join(fixture, 'worktree');
  execFileSync(git, ['-C', repo, 'worktree', 'add', '--detach', worktree, 'HEAD']);
  const w = client(worktree);
  await w.request('initialize');
  assert.match(await w.tool('graft_trace_calls', { symbol: 'add' }), /total/);
  w.close();

  const plain = join(fixture, 'plain'); mkdirSync(plain);
  const p = client(plain);
  await p.request('initialize');
  assert.deepEqual((await p.request('tools/list')).result.tools, []);
  assert.equal(existsSync(join(plain, 'graft')), false);
  p.close();
  console.log(`Portable integration passed: ${process.platform}-${process.arch}; six MCP tools, native/WASM parsers, refresh, concurrent startup, subdirectory, worktree, no-repository guard.`);
} finally {
  await Promise.all(children.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  })));
  rmSync(fixture, { recursive: true, force: true });
}
