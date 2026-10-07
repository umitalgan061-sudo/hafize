import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const mustExist = [
  'public/typed/chat-composer-features.ts',
  'public/typed/chat-history-search.ts',
  'public/typed/chat-history-management.ts',
  'public/typed/hands-free.ts',
  'public/typed/hands-free-background-guard.ts',
  'public/typed/settings-privacy.ts',
  'public/typed/workspace-navigation.ts',
  'public/typed/hafize-sse.ts',
  'public/typed/hafize-storage.ts',
  'public/typed/hafize-async.ts',
  'public/typed/hafize-stream-state.ts'
];
// The pre-migration browser entries must stay deleted; their typed replacements are
// asserted in mustExist above.
const legacyAbsent = [
  'public/chat-composer-features.js',
  'public/chat-history-search.js',
  'public/chat-history-management.js',
  'public/hands-free.js',
  'public/hands-free-background-guard.js',
  'public/settings-privacy.js',
  'public/workspace-navigation.js'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const path of mustExist) await access(join(root, path));

for (const path of legacyAbsent) {
  try {
    await access(join(root, path));
    throw new Error('Legacy entrypoint still exists: ' + path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const index = await readFile(join(root, 'public/index.html'), 'utf8');
const vite = await readFile(join(root, 'vite.config.ts'), 'utf8');
const sw = await readFile(join(root, 'public/sw-policy.ts'), 'utf8');

const migratedNames = [
  'chat-composer-features',
  'chat-history-search',
  'chat-history-management',
  'hands-free',
  'hands-free-background-guard',
  'settings-privacy',
  'workspace-navigation'
];

for (const name of migratedNames) {
  assert(index.includes('/typed-build/' + name + '.js'), 'index.html does not use typed build for ' + name);
  assert(vite.includes(name), 'vite.config.ts has no entry for ' + name);
  assert(sw.includes('/typed-build/' + name + '.js'), 'service worker does not cache typed build for ' + name);
}

assert(index.includes('stream-status.css'), 'stream status stylesheet is not wired');
assert(index.includes('/typed-build/app-shell.js'), 'app shell must use typed build');
// hafize-sse.ts is not its own entry: it reaches the bundle through the app shell,
// so the graph edge is what has to hold.
const appShell = await readFile(join(root, 'public/typed/app-shell.ts'), 'utf8');
assert(vite.includes("resolve(ROOT, 'public/typed/app-shell.ts')"), 'app-shell must be a Vite entry');
assert(appShell.includes('hafize-sse.ts'), 'Vite graph must include typed SSE dependency through the app shell');
assert(appShell.includes('hafize-stream-state.ts'), 'Vite graph must include typed stream state through the app shell');
assert(vite.includes('emptyOutDir: true'), 'Vite build must remain deterministic');

const publicFiles = legacyAbsent.map((path) => path.replace(/^public\//, '').replace(/\.js$/, '.ts')).map((path) => 'public/typed/' + path.split('/').pop());
publicFiles.push('public/typed/hafize-sse.ts', 'public/typed/hafize-storage.ts', 'public/typed/hafize-async.ts', 'public/typed/hafize-stream-state.ts');

for (const path of publicFiles) {
  const source = await readFile(join(root, path), 'utf8');
  assert(!/NVIDIA_API_KEY|GITHUB_TOKEN|CLIENT_SECRET|PRIVATE_KEY|Bearer [A-Za-z0-9_-]{12,}/i.test(source), 'possible credential-like material in ' + path);
  assert(!/fetch\([^)]*https?:\/\//.test(source), 'direct hard-coded remote fetch found in ' + path);
}

console.log('TypeScript frontend migration wave contract: PASS');