import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const controllerPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const appPath = fileURLToPath(new URL('../public/app.js', import.meta.url));
const indexPath = fileURLToPath(new URL('../public/index.html', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const [controllerSource, appSource, indexSource, policySource] = await Promise.all([
  readFile(controllerPath, 'utf8'),
  readFile(appPath, 'utf8'),
  readFile(indexPath, 'utf8'),
  readFile(policyPath, 'utf8')
]);
const swPolicy = require('../public/sw-policy.js');

for (const path of [controllerPath, appPath, policyPath]) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || `${path} syntax failed`);
}

const controllerIndex = indexSource.indexOf('<script src="/chat-run-controller.js" defer></script>');
const appIndex = indexSource.indexOf('<script src="/app.js" defer></script>');
assert.ok(controllerIndex >= 0 && appIndex > controllerIndex, 'chat-run-controller must execute before app.js');
assert.match(controllerSource, /root\.HafizeChatRunController = api;\s*api\.installSseIntegrity\(root\);/);

assert.match(appSource, /fetch\('\/api\/chat'/);
assert.match(appSource, /fetch\('\/api\/agent\/run'/);
assert.match(appSource, /const blocks = buffer\.split\('\n\\n'\)/);
assert.match(appSource, /buffer = blocks\.pop\(\) \|\| ''/);
assert.match(controllerSource, /normalizer\.finish\(tail\)/, 'guard must flush unterminated final frame');
assert.match(controllerSource, /controller\.enqueue\(encoder\.encode\(frame\)\)/);

assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v80');
assert.equal(swPolicy.SHELL_ASSETS.includes('/chat-run-controller.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/app.js'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.test/api/chat',
  headers: { accept: 'text/event-stream' },
  mode: 'cors'
}, 'https://hafize.test'), 'ignore', 'service worker must not cache POST chat streams');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.test/api/chat',
  headers: { accept: 'text/event-stream' },
  mode: 'cors'
}, 'https://hafize.test'), 'network-only');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.test/chat-run-controller.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.test'), 'shell');

assert.match(policySource, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v80`/);
assert.equal(controllerSource.includes("'/api/github/write/execute'"), false, 'SSE guard must not absorb GitHub write routes');
assert.equal(controllerSource.includes("'/api/schedules'"), false, 'SSE guard must not absorb schedule API routes');

console.log('SSE stream integrity integration tests passed');
