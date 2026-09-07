import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = JSON.parse(readFileSync(join(root, 'scripts/portable/config.json')));
const entries = [];
for (const [suffix, label] of [['windows', 'Windows x64'], ['unix', 'Linux x64 / macOS ARM64']]) {
  const name = `graft-${suffix}`;
  const dir = join(root, 'plugins', name);
  mkdirSync(join(dir, '.codex-plugin'), { recursive: true });
  mkdirSync(join(dir, 'skills/graft'), { recursive: true });
  cpSync(join(root, 'LICENSE'), join(dir, 'LICENSE'));
  writeFileSync(join(dir, '.codex-plugin/plugin.json'), JSON.stringify({
    name, version: cfg.version, description: `Graft code search and caller tracing for ${label}, with a prebuilt runtime.`,
    author: { name: 'digimbyte' }, license: 'MIT', homepage: 'https://github.com/digimbyte/Graft',
    skills: './skills/', mcpServers: './.mcp.json',
    interface: { displayName: `Graft (${label})`, shortDescription: 'Local code navigation without compiler setup.',
      longDescription: 'Downloads a versioned runtime with Node and compiled parsers. Indexes the current Git repository locally. No npm installation or model API key required.',
      developerName: 'digimbyte', category: 'Productivity', capabilities: [], defaultPrompt: 'Map this repository and trace the callers relevant to my change.' }
  }, null, 2) + '\n');
  const windows = suffix === 'windows';
  const launcher = windows ? 'launch.ps1' : 'launch.sh';
  cpSync(join(root, 'scripts/portable', launcher), join(dir, launcher));
  writeFileSync(join(dir, 'runtime.json'), JSON.stringify(cfg, null, 2) + '\n');
  writeFileSync(join(dir, 'release.env'), `GRAFT_TAG='${cfg.tag}'\nGRAFT_REPOSITORY='${cfg.repository}'\n`);
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { graft: {
    command: windows ? 'powershell.exe' : 'sh',
    args: windows ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', '${CODEX_PLUGIN_ROOT}/launch.ps1', 'mcp'] : ['${CODEX_PLUGIN_ROOT}/launch.sh', 'mcp'],
    startup_timeout_sec: 300, tool_timeout_sec: 180,
    env: { DO_NOT_TRACK: '1' }
  } } }, null, 2) + '\n');
  writeFileSync(join(dir, 'skills/graft/SKILL.md'), `---\nname: graft\ndescription: Search code, inspect APIs, map repositories, and trace callers using the Graft tools.\n---\n\nUse the six Graft MCP tools for targeted code exploration. The first start indexes\nthe current Git repository locally, including worktrees. Later queries refresh\nthe graph as source changes. No model API key is needed for structural indexing.\n\nUse graft_repo_map to orient, graft_find_code to find definitions, graft_file_api\nto inspect signatures, graft_trace_calls to trace dependencies, graft_find_all\nfor indexed text search, and graft_check_freshness to inspect drift. Check source\nand use ordinary file search where graph coverage is incomplete. Respect the\nrepository's existing instructions and requested change scope.\n\nIf the task has no Git repository, Graft may expose no tools. Start a task in the\nintended repository; do not index a broad parent folder automatically.\n\nThe runtime downloads once per plugin release and is cached locally. Updating the\nplugin selects its pinned runtime; do not run npm upgrade or graft init to manage\nthis plugin. It does not install global hooks or rewrite agent instruction files.\nFor manual CLI use, run this plugin's ${launcher} with normal Graft arguments.\nWindows uses PowerShell -File; Unix uses sh. Keep the task working directory.\n\nDisable or uninstall through Codex Plugins. Runtime caches and repository graphs\nremain on disk for reuse; remove only the specific cache when requested.\n`);
  entries.push({ name, source: { source: 'local', path: `./plugins/${name}` }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' });
}
mkdirSync(join(root, '.agents/plugins'), { recursive: true });
writeFileSync(join(root, '.agents/plugins/marketplace.json'), JSON.stringify({ name: 'digimbyte-graft', interface: { displayName: 'Graft by digimbyte' }, plugins: entries }, null, 2) + '\n');
