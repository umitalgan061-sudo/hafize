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
for (const entry of ['auth', 'app-shell', 'ui-shell', 'voice-input', 'voice-output']) {
  assert.match(vite, new RegExp(entry));
  assert.match(html, new RegExp(`typed-build/${entry}\\.js`));
  assert.match(sw, new RegExp(`typed-build/${entry}\\.js`));
}
for (const legacy of ['public/app.js', 'public/auth.js', 'public/ui-shell.js', 'public/voice-input.js', 'public/voice-output.js']) {
  assert.equal(existsSync(join(root, legacy)), false, `legacy entry still exists: ${legacy}`);
}
assert.equal(existsSync(join(root, 'server.mjs')), false);
assert.equal(existsSync(join(root, 'server.ts')), true);
assert.equal(existsSync(join(root, 'public/typed/app-shell.ts')), true);
assert.doesNotMatch(html, /<script[^>]+src=["']\/app\.js["']/);
assert.doesNotMatch(html, /<script[^>]+src=["']\/auth\.js["']/);
console.log('TypeScript entrypoint release gate: ok');
