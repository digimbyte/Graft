// Portable-only entry point. Preserve upstream CLI behaviour and host settings.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.env.DO_NOT_TRACK = '1';
// Pause incoming MCP data during first-use indexing; no protocol bytes are lost.
process.stdin.pause();
let root = process.cwd();
while (!existsSync(join(root, '.git'))) {
  const parent = dirname(root);
  if (parent === root) { root = process.cwd(); break; }
  root = parent;
}
const { startMcpServer } = await import('../../dist/mcp/server.js');
if (existsSync(join(root, '.git')) && !existsSync(join(root, 'graft/.graph/wiring.json'))) {
  const { acquireLockIn, releaseLockIn } = await import('../../dist/util/state.js');
  const { releaseOnSignal } = await import('../../dist/graph/refresh.js');
  const cache = join(root, 'graft/.cache');
  const deadline = Date.now() + 240_000;
  while (!acquireLockIn(cache)) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for initial Graft index');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const unhook = releaseOnSignal(cache);
  const { buildGraph } = await import('../../dist/graph/build.js');
  try {
    if (!existsSync(join(root, 'graft/.graph/wiring.json'))) {
      console.error(`Graft: indexing ${root}`);
      const result = await buildGraph(root, { graphOnly: true });
      if (result.errors.length) console.error(`Graft: ${result.errors.length} files could not be indexed`);
    }
  } finally { unhook(); releaseLockIn(cache); }
}
const version = JSON.parse(readFileSync(join(app, 'package.json'))).version;
startMcpServer(root, undefined, version, { upkeep: false });
process.stdin.resume();
