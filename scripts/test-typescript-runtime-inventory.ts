import { access, readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const LEGACY_SERVER_ENTRY = 'server.mjs';
const MODERN_SERVER_ENTRY = 'server.ts';
const CORE_MIGRATED = [
  'server.ts',
  'lib/delegated-agent-runner.ts',
  'lib/github-read.ts',
  'lib/canva-agent-runtime.ts',
  'lib/gmail-agent-runtime.ts',
  'lib/redis-schedule-lease-runtime.ts',
  'lib/schedule-storage-runtime.ts',
  'lib/schedule-http-api.ts',
  'lib/connector-owner-principal.ts',
  'lib/plaintext-credential-policy.ts',
  'lib/task-schedule-store.ts',
  'lib/runtime-types.ts',
  'lib/runtime-resilience.ts'
];

async function exists(path) {
  try {
    await access(new URL(path, ROOT));
    return true;
  } catch {
    return false;
  }
}

async function walk(path, result = []) {
  const entries = await readdir(new URL(path, ROOT), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'typed-build') continue;
    const next = join(path, entry.name);
    if (entry.isDirectory()) await walk(next, result);
    else if (extname(entry.name) === '.mjs' || extname(entry.name) === '.ts') result.push(next);
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(`TYPESCRIPT_INVENTORY_FAILED:${message}`);
}

const server = await readFile(new URL(MODERN_SERVER_ENTRY, ROOT), 'utf8');
const packageData = JSON.parse(await readFile(new URL('package.json', ROOT), 'utf8'));
const tsconfig = JSON.parse(await readFile(new URL('tsconfig.runtime.json', ROOT), 'utf8'));

assert(!(await exists(LEGACY_SERVER_ENTRY)), 'legacy-server-entry-still-present');
assert(server.includes('./lib/runtime-resilience.ts'), 'resilience-not-wired');
assert(String(packageData.scripts?.start || '').includes(MODERN_SERVER_ENTRY), 'start-not-typed');
assert(String(packageData.scripts?.['dev:server'] || '').includes(MODERN_SERVER_ENTRY), 'dev-server-not-typed');
assert(String(packageData.scripts?.['check:modern'] || '').includes('test-typescript-migration.ts'), 'migration-gate-not-typed');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('lib/**/*.ts'), 'runtime-ts-scope-missing');

for (const path of CORE_MIGRATED) assert(await exists(path), `missing:${path}`);

const files = await walk('lib');
const legacyWithTypedSibling = new Set();
for (const file of files) {
  if (!file.endsWith('.mjs')) continue;
  const sibling = file.slice(0, -4) + '.ts';
  if (await exists(sibling)) legacyWithTypedSibling.add(relative(new URL('../', ROOT), file));
}
assert(!legacyWithTypedSibling.has('lib/server.mjs'), 'server-legacy-alias');

const staleImports = [];
for (const file of files.filter((item) => item.endsWith('.ts'))) {
  const source = await readFile(new URL(file, ROOT), 'utf8');
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (match[1].endsWith('.mjs')) staleImports.push(`${file} -> ${match[1]}`);
  }
}
for (const item of staleImports) {
  if (/delegated-agent-runner|agent-runtime|agent-delegation|model-response-contract|tool-runtime|calendar-contract|oauth-token-store-runtime|canva-read-client|canva-read-tool-boundary|gmail-read-client|gmail-read-tool-boundary|redis-lease-client-factory|redis-schedule-lease-adapter|schedule-lease-runtime-config|encrypted-file-schedule-adapter|encrypted-schedule-config|task-schedule-persistence|task-schedule-store|api-error-contract/.test(item)) {
    throw new Error(`TYPESCRIPT_INVENTORY_FAILED:stale-core-import:${item}`);
  }
}

console.log('TypeScript runtime inventory: OK');
console.log(`Typed core modules checked: ${CORE_MIGRATED.length}`);
console.log(`Legacy+typed sibling pairs: ${legacyWithTypedSibling.size}`);
