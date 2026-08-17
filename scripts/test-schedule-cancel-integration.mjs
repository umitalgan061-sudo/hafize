import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cancel = require('../public/schedule-cancel.js');
const swPolicy = require('../public/sw-policy.js');

const sourcePath = fileURLToPath(new URL('../public/schedule-cancel.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/schedule-cancel.css', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const listPath = fileURLToPath(new URL('../public/schedule-list.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const [source, style, loader, list, policy] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(listPath, 'utf8'),
  readFile(policyPath, 'utf8')
]);

for (const path of [sourcePath, loaderPath, listPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

assert.equal(cancel.normalizeScheduleId('abc-123'), 'abc-123');
assert.match(loader, /HafizeScheduleCancel.*\/schedule-cancel\.js/);
assert.equal(loader.split("'/schedule-cancel.js'").length - 1, 1, 'cancel loader must be exact-once');
assert.match(list, /article\.dataset\.scheduleId = item\.scheduleId/);
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v67');
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-cancel.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-cancel.css'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'DELETE',
  url: 'https://hafize.example/api/schedules/abc-123',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'ignore', 'service worker must not cache DELETE');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/schedule-cancel.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');

assert.match(style, /min-height:\s*42px/);
assert.match(style, /focus-visible/);
assert.match(style, /prefers-reduced-motion:\s*reduce/);
assert.match(style, /forced-colors:\s*active/);
assert.match(source, /role', 'status'/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /data-hafize-schedule-cancel-mounted/);
assert.match(source, /observer\?\.disconnect/);
assert.match(source, /removeEventListener/);

console.log('schedule cancel integration tests passed');
