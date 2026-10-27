// Bundles the Electron main process and preload with esbuild (CommonJS).
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const common = { bundle: true, platform: 'node', format: 'cjs', target: 'node22', sourcemap: 'linked', logLevel: 'warning', external: ['electron', 'better-sqlite3'] };
await Promise.all([
  build({ ...common, entryPoints: [path.join(dir, 'src/main.ts')], outfile: path.join(dir, 'dist/main.cjs') }),
  build({ ...common, entryPoints: [path.join(dir, 'src/preload.ts')], outfile: path.join(dir, 'dist/preload.cjs') }),
]);
