// Run after npm ci. Native modules are built here, never on the user's machine.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = JSON.parse(readFileSync(join(root, 'scripts/portable/config.json')));
const target = `${process.platform}-${process.arch}`;
if (!cfg.targets.includes(target)) throw new Error(`Unsupported release target: ${target}`);
if (process.versions.node !== cfg.nodeVersion) throw new Error(`Build with Node ${cfg.nodeVersion}`);
const out = resolve(process.argv[2] || join(root, '.portable'));
const stage = join(out, `graft-${target}`);
if (existsSync(stage)) throw new Error(`Staging directory already exists: ${stage}`);
mkdirSync(stage, { recursive: true });
const app = join(stage, 'app');
mkdirSync(app);
for (const name of ['dist', 'scripts', 'node_modules', 'package.json', 'package-lock.json', 'LICENSE', 'CREDITS.md']) {
  cpSync(join(root, name), join(app, name), { recursive: true, dereference: true });
}
// Prune the staged copy only; ignore lifecycle scripts so no second compile occurs.
const npmCli = process.env.npm_execpath || (process.platform === 'win32'
  ? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
  : resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'));
execFileSync(process.execPath, [npmCli, 'prune', '--omit=dev', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], { cwd: app, stdio: 'inherit' });
cpSync(process.execPath, join(stage, process.platform === 'win32' ? 'node.exe' : 'node'));
// Include the Node distribution's license (covers its bundled dependencies).
const licenseCandidates = [join(dirname(process.execPath), 'LICENSE'), resolve(dirname(process.execPath), '../LICENSE')];
let nodeLicense = licenseCandidates.find(existsSync);
if (!nodeLicense) {
  // The license text is versioned in the official Node source tree.
  const license = await fetch(`https://raw.githubusercontent.com/nodejs/node/v${cfg.nodeVersion}/LICENSE`);
  if (!license.ok) throw new Error('Cannot obtain Node license');
  writeFileSync(join(stage, 'NODE-LICENSE'), await license.text());
} else cpSync(nodeLicense, join(stage, 'NODE-LICENSE'));
writeFileSync(join(stage, 'runtime.json'), JSON.stringify({ ...cfg, target, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() }, null, 2));
const archive = join(out, `graft-${target}.tar.gz`);
execFileSync('tar', ['-czf', archive, '-C', out, `graft-${target}`], { stdio: 'inherit' });
const sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync(`${archive}.sha256`, `${sha256}  graft-${target}.tar.gz\n`);
console.log(JSON.stringify({ stage, archive, sha256 }));
