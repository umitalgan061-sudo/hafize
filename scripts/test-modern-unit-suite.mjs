// The typed browser modules are unit-tested with Vitest. The main gate runs
// that suite too, so `npm run check` cannot pass while the typed runtime is
// broken — which is exactly how the TypeScript migration rotted unnoticed.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['vitest', 'run', '--reporter=dot'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, CI: '' }
});

if (result.error) {
  console.error(`modern unit suite could not run: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(result.stdout || '');
  console.error(result.stderr || '');
  process.exit(1);
}

const summary = (result.stdout || '').split('\n').find((line) => line.includes('Tests')) || '';
console.log(`modern unit suite: ok${summary ? ` (${summary.trim()})` : ''}`);
