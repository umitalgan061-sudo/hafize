import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const vite = read('vite.config.ts');
const html = read('public/index.html');
const sw = read('public/sw-policy.js');
const runtime = read('tsconfig.runtime.json');

assert.equal(pkg.scripts.start, 'node --import ./lib/production-guard.ts server.ts');
assert.equal(pkg.scripts['dev:server'], 'node --import ./lib/production-guard.ts server.ts');
assert.match(runtime, /server\.ts/);
for (const entry of ['auth', 'app-shell', 'ui-shell', 'voice-input', 'voice-output', 'markdown-renderer', 'conversation-workspace', 'message-workspace', 'prompt-library', 'scheduled-tasks']) {
  assert.match(vite, new RegExp(entry));
  assert.match(html, new RegExp(`typed-build/${entry}\\.js`));
  assert.match(sw, new RegExp(`typed-build/${entry}\\.js`));
}
// Taşınmış legacy tarayıcı girişleri ve eski sunucu girişi depodan kalkmıştır.
for (const legacy of ['public/app.js', 'public/auth.js', 'public/ui-shell.js', 'public/voice-input.js', 'public/voice-output.js', 'server.mjs']) {
  assert.equal(existsSync(join(root, legacy)), false, `legacy entry still exists: ${legacy}`);
}
// Typed karşılıkları yerinde olmalıdır.
for (const typed of [
  'server.ts',
  'public/typed/app-shell.ts',
  'public/typed/auth.ts',
  'public/typed/ui-shell.ts',
  'public/typed/voice-input.ts',
  'public/typed/voice-output.ts',
  'public/markdown-renderer.ts',
  'public/conversation-workspace.ts',
  'public/typed/message-workspace.ts',
  'public/typed/prompt-library.ts',
  'public/typed/scheduled-tasks.ts'
]) {
  assert.equal(existsSync(join(root, typed)), true, `typed entry missing: ${typed}`);
}
assert.doesNotMatch(html, /<script[^>]+src=["']\/app\.js["']/);
assert.doesNotMatch(html, /<script[^>]+src=["']\/auth\.js["']/);
console.log('TypeScript entrypoint release gate: ok');
