import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const index = await readFile(join(root, 'public/index.html'), 'utf8');
const vite = await readFile(join(root, 'vite.config.ts'), 'utf8');
const sw = await readFile(join(root, 'public/sw-policy.ts'), 'utf8');

assert(packageJson.engines?.node === '>=24.21.0', 'Node engine floor changed unexpectedly');
assert(packageJson.devDependencies?.typescript === '7.0.2', 'TypeScript toolchain is not pinned to the approved major');
assert(packageJson.devDependencies?.vite === '8.3.0', 'Vite toolchain is not pinned to the approved release');
assert(packageJson.devDependencies?.vitest === '5.0.1', 'Vitest toolchain is not pinned to the approved release');
assert(packageJson.scripts?.build === 'vite build', 'production build must bundle through Vite');
assert(packageJson.scripts?.build.includes('vite build'), 'production build must bundle through Vite');

const typedEntries = [
  'auth',
  'app-shell',
  'ui-shell',
  'voice-input',
  'voice-output',
  'app-runtime',
  'prompt-library-smart-fill',
  'prompt-library-command-palette',
  'scheduled-tasks-countdown',
  'prompt-library-smart-fill-hints',
  'conversation-forks',
  'github-workspace',
  'github-workspace-extra',
  'github-workspace-actions',
  'github-workspace-details',
  'github-workspace-write',
  'workspace-backup',
  'system-readiness-panel',
  'markdown-renderer',
  'conversation-workspace',
  'message-workspace',
  'prompt-library',
  'scheduled-tasks',
  'chat-composer-features',
  'chat-history-search',
  'chat-history-management',
  'hands-free',
  'hands-free-background-guard',
  'settings-privacy',
  'workspace-navigation'
];

for (const entry of typedEntries) {
  assert(vite.includes("'" + entry + "': resolve(ROOT"), 'missing Vite build entry: ' + entry);
  assert(index.includes('/typed-build/' + entry + '.js'), 'missing typed HTML entry: ' + entry);
  assert(sw.includes('/typed-build/' + entry + '.js'), 'missing PWA cache entry: ' + entry);
}

for (const entry of typedEntries) {
  const oldScript = '<script src="/' + entry + '.js" defer></script>';
  assert(!index.includes(oldScript), 'legacy and typed entrypoints are both active: ' + entry);
}

const duplicates = index.split(/\n/).filter((line) => line.includes('src="/')).map((line) => line.match(/src="([^"]+)/)?.[1]).filter(Boolean);
const counts = new Map();
for (const src of duplicates) counts.set(src, (counts.get(src) ?? 0) + 1);
for (const [src, count] of counts) assert(count <= 1, 'duplicate browser entrypoint: ' + src);

assert(vite.includes("target: 'es2022'"), 'browser target should remain explicit and modern');
assert(vite.includes("formats: ['es']"), 'production frontend format should remain ESM');
assert(vite.includes('sourcemap: true'), 'production debugging sourcemaps must remain enabled');
assert(vite.includes('emptyOutDir: true'), 'typed build output must be deterministic');
assert(vite.includes("resolve(ROOT, 'public/typed/hafize-sse.ts')") || vite.includes('hafize-sse.ts'), 'typed SSE source must remain in the dependency graph');

const cacheVersion = sw.match(/hafize-shell-v(\d+)/)?.[1];
assert(cacheVersion === '54', 'Service Worker cache version must match the current migration wave');
assert(sw.includes("'/stream-status.css'"), 'stream status CSS must be cached by the shell');
assert(sw.includes("'/typed-build/chat-composer-features.js'"), 'migrated composer entry missing from shell cache');
assert(sw.includes("'/typed-build/settings-privacy.js'"), 'migrated privacy entry missing from shell cache');
assert(sw.includes("'/typed-build/hands-free.js'"), 'migrated voice entry missing from shell cache');

assert(index.includes('<html lang="tr"'), 'document language must remain Turkish');
assert(index.includes('aria-label="Mesaj"'), 'composer accessibility label was lost');
assert(index.includes('id="toast"'), 'shared toast surface was lost');
assert(index.includes('id="handsFreeIndicator"'), 'hands-free status surface was lost');
assert(index.includes('id="messageInput"'), 'composer input was lost');

for (const forbidden of [
  'NVIDIA_API_KEY=',
  'GITHUB_CLIENT_SECRET=',
  'GOOGLE_CLIENT_SECRET=',
  'CANVA_CLIENT_SECRET=',
  '-----BEGIN PRIVATE KEY-----'
]) {
  assert(!index.includes(forbidden), 'credential marker found in index.html: ' + forbidden);
}

assert(!/https:\/\/(?!localhost)/.test(index), 'index.html should not hard-code external runtime URLs');
assert(!/https:\/\/(?!localhost)/.test(vite), 'Vite config should not hard-code external runtime service URLs');

const checks = packageJson.scripts?.['check:modern'] || '';
for (const gate of [
  'scripts/test-typescript-frontend-wave.mjs',
  'scripts/test-sse-transport-contract.mjs',
  'scripts/test-typescript-frontend-runtime-boundary.mjs'
]) assert(checks.includes(gate), 'modern check chain is missing: ' + gate);

console.log('TypeScript frontend regression contract: PASS');