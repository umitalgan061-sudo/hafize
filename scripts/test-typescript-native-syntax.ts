import { access, readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const ROOT = new URL('../', import.meta.url);
const TARGETS = [
  'server.ts',
  'lib/runtime-types.ts',
  'lib/runtime-resilience.ts',
  'lib/delegated-agent-runner.ts',
  'lib/github-read.ts',
  'lib/canva-agent-runtime.ts',
  'lib/gmail-agent-runtime.ts',
  'lib/redis-schedule-lease-runtime.ts',
  'lib/schedule-storage-runtime.ts',
  'lib/schedule-http-api.ts',
  'lib/task-schedule-store.ts',
  'lib/runtime-readiness.ts',
  'lib/config-readiness.ts',
  'lib/pwa-readiness.ts',
  'lib/release-manifest.ts',
  'lib/agent-lifecycle.ts',
  'lib/calendar-contract.ts',
  'lib/calendar-read-runtime.ts',
  'lib/connector-capabilities.ts'
];

async function exists(path) {
  try { await access(new URL(path, ROOT)); return true; } catch { return false; }
}

function assert(condition, message) {
  if (!condition) throw new Error(`NATIVE_TYPESCRIPT_SYNTAX_FAILED:${message}`);
}

for (const target of TARGETS) {
  assert(await exists(target), `missing:${target}`);
  const source = await readFile(new URL(target, ROOT), 'utf8');
  let stripped = '';
  try {
    stripped = stripTypeScriptTypes(source, { mode: 'strip' });
  } catch (error) {
    throw new Error(`NATIVE_TYPESCRIPT_SYNTAX_FAILED:${target}:${error instanceof Error ? error.message : String(error)}`);
  }

  assert(typeof stripped === 'string' && stripped.length > 0, `empty-strip:${target}`);
  assert(!/\benum\s+[A-Za-z_$]/.test(source), `enum-not-erasable:${target}`);
  assert(!/\bnamespace\s+[A-Za-z_$]/.test(source), `namespace-not-erasable:${target}`);
  assert(!/constructor\s*\(\s*(public|private|protected|readonly)\b/.test(source), `parameter-property-not-erasable:${target}`);
}

console.log(`Native TypeScript syntax gate: OK (${TARGETS.length} files)`);
