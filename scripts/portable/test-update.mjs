import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const updater = resolve(dirname(fileURLToPath(import.meta.url)), 'prepare-update.mjs');
function fixture() {
  const temp = mkdtempSync(join(tmpdir(), 'graft-update-'));
  const repo = join(temp, 'repo'); mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (path, text) => { mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), text); };
  git('init', '-q');
  git('config', 'user.name', 'Updater test'); git('config', 'user.email', 'test@example.invalid');
  write('package.json', '{"version":"1.0.0"}\n');
  write('core.txt', 'original\n');
  write('.github/workflows/ci.yml', 'upstream workflow\n');
  write('scripts/portable/config.json', JSON.stringify({ version: '0.1.0', tag: 'portable-v0.1.0', nodeVersion: '24.11.1' }));
  write('scripts/portable/generate-plugins.mjs', "import {readFileSync,writeFileSync} from 'node:fs'; writeFileSync('plugins/version.json', readFileSync('scripts/portable/config.json'));\n");
  for (const path of ['plugins/version.json', '.agents/plugins/marketplace.json', 'docs/portable.md', 'docs/portable-release.md']) write(path, '{}\n');
  git('add', '.'); git('commit', '-qm', 'initial');
  const initial = git('rev-parse', 'HEAD');
  write('.github/workflows/ci.yml', 'fork workflow\n');
  git('commit', '-qam', 'fork wrapper');
  const base = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/upstream/main', initial);
  const run = () => spawnSync(process.execPath, [updater], { cwd: repo, encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: temp, GITHUB_OUTPUT: join(temp, 'outputs') } });
  return { temp, repo, git, write, run, initial, base, cleanup: () => rmSync(temp, { recursive: true, force: true }) };
}

test('unchanged upstream skips version changes and artifact creation', () => {
  const f = fixture();
  try {
    const r = f.run(); assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).changed, false);
    assert.equal(f.git('rev-parse', 'HEAD'), f.base);
    assert.equal(existsSync(join(f.temp, 'graft-candidate.bundle')), false);
  } finally { f.cleanup(); }
});

test('changed upstream creates a transferable versioned candidate and preserves fork workflows', () => {
  const f = fixture();
  try {
    f.git('checkout', '--detach', f.initial);
    f.write('core.txt', 'new upstream code\n');
    f.write('.github/workflows/ci.yml', 'new upstream workflow\n');
    f.git('commit', '-qam', 'upstream update');
    const upstream = f.git('rev-parse', 'HEAD');
    f.git('update-ref', 'refs/remotes/upstream/main', upstream);
    f.git('checkout', '--detach', f.base);
    const r = f.run(); assert.equal(r.status, 0, r.stderr);
    const output = JSON.parse(r.stdout.trim().split('\n').at(-1));
    assert.equal(output.changed, true);
    assert.equal(output.tag, 'portable-v0.1.1');
    assert.equal(readFileSync(join(f.repo, 'core.txt'), 'utf8'), 'new upstream code\n');
    assert.equal(readFileSync(join(f.repo, '.github/workflows/ci.yml'), 'utf8'), 'fork workflow\n');
    const cfg = JSON.parse(readFileSync(join(f.repo, 'scripts/portable/config.json')));
    assert.equal(cfg.upstreamCommit, upstream);
    assert.equal(f.git('status', '--porcelain'), '');
    f.git('bundle', 'verify', join(f.temp, 'graft-candidate.bundle'));
    const clone = join(f.temp, 'consumer');
    f.git('clone', '--quiet', '--no-checkout', f.repo, clone);
    execFileSync('git', ['fetch', join(f.temp, 'graft-candidate.bundle'), 'HEAD'], { cwd: clone, stdio: 'pipe' });
    assert.equal(execFileSync('git', ['rev-parse', 'FETCH_HEAD'], { cwd: clone, encoding: 'utf8' }).trim(), output.sha);
    const again = f.run(); assert.equal(again.status, 0, again.stderr);
    assert.equal(JSON.parse(again.stdout).changed, false);
  } finally { f.cleanup(); }
});

test('core merge conflict aborts without changing the fork or version', () => {
  const f = fixture();
  try {
    f.write('core.txt', 'fork implementation\n'); f.git('commit', '-qam', 'fork core');
    const fork = f.git('rev-parse', 'HEAD');
    f.git('checkout', '--detach', f.initial);
    f.write('core.txt', 'upstream implementation\n'); f.git('commit', '-qam', 'upstream core');
    f.git('update-ref', 'refs/remotes/upstream/main', f.git('rev-parse', 'HEAD'));
    f.git('checkout', '--detach', fork);
    const r = f.run(); assert.notEqual(r.status, 0);
    assert.match(r.stderr, /manual resolution: core.txt/);
    assert.equal(f.git('rev-parse', 'HEAD'), fork);
    assert.equal(f.git('status', '--porcelain'), '');
    assert.equal(existsSync(join(f.temp, 'graft-candidate.bundle')), false);
  } finally { f.cleanup(); }
});
