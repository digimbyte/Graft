// Prepare a candidate locally. Publishing happens only after platform tests pass.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const output = (values) => {
  for (const [key, value] of Object.entries(values)) {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
  console.log(JSON.stringify(values));
};
if (git('status', '--porcelain')) throw new Error('Updater requires a clean checkout');
const base = git('rev-parse', 'HEAD');
const upstream = git('rev-parse', '--verify', `${process.argv[2] || 'refs/remotes/upstream/main'}^{commit}`);
const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', upstream, base]);
if (ancestor.status === 0) {
  output({ changed: false, base, upstream });
} else {
  if (ancestor.status !== 1) throw new Error('Cannot compare upstream history');
  const previous = JSON.parse(readFileSync('scripts/portable/config.json', 'utf8'));
  const owned = ['.github/workflows', 'scripts/portable', 'plugins', '.agents/plugins', 'docs/portable.md', 'docs/portable-release.md'];
  const merge = spawnSync('git', ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'merge', '--no-ff', '--no-commit', upstream], { encoding: 'utf8' });
  // Workflow and wrapper files belong to this distribution. Keep their current
  // versions, including when upstream adds similarly named files in the future.
  git('restore', '--source', base, '--staged', '--worktree', '--', ...owned);
  const conflicts = git('diff', '--name-only', '--diff-filter=U');
  if (conflicts || (merge.status !== 0 && !git('rev-parse', '-q', '--verify', 'MERGE_HEAD'))) {
    git('merge', '--abort');
    throw new Error(`Upstream merge requires manual resolution: ${conflicts || merge.stderr}`);
  }
  const versionParts = previous.version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!versionParts) throw new Error('Portable version must be a stable semantic version');
  const version = `${versionParts[1]}.${versionParts[2]}.${Number(versionParts[3]) + 1}`;
  const config = { ...previous, version, tag: `portable-v${version}`, upstreamCommit: upstream };
  writeFileSync('scripts/portable/config.json', JSON.stringify(config, null, 2) + '\n');
  execFileSync(process.execPath, ['scripts/portable/generate-plugins.mjs'], { stdio: 'inherit' });
  const graftVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  writeFileSync('docs/portable-release.md', `Graft portable ${version} packages upstream Graft ${graftVersion}.\n\nUpstream source: https://github.com/trailhq/Graft/commit/${upstream}\n\nIncludes Windows x64, Linux x64, and macOS Apple Silicon runtimes with Node ${config.nodeVersion}, compiled parsers, and SHA-256 checksums.\n\nInstallation: https://github.com/digimbyte/Graft/blob/main/docs/portable.md\n`);
  git('add', 'scripts/portable/config.json', 'plugins', '.agents/plugins', 'docs/portable-release.md');
  git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', `Update portable Graft to upstream ${upstream.slice(0, 12)}`);
  const sha = git('rev-parse', 'HEAD');
  // An incremental bundle keeps the candidate off main until it is tested.
  git('bundle', 'create', resolve(process.env.RUNNER_TEMP || '..', 'graft-candidate.bundle'), 'HEAD', `^${base}`);
  output({ changed: true, base, upstream, sha, tag: config.tag });
}
