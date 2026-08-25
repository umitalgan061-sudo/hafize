import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');

const sourcePath = fileURLToPath(new URL('../public/schedule-reschedule.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/schedule-reschedule.css', import.meta.url));
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

assert.match(loader, /HafizeScheduleReschedule.*\/schedule-reschedule\.js/);
assert.equal(loader.split("'/schedule-reschedule.js'").length - 1, 1, 'reschedule loader must be exact-once');
assert.match(list, /RESCHEDULED_EVENT = 'hafize:schedule-rescheduled'/);
assert.match(list, /meta\.dataset\.runAt = item\.runAt/);
assert.match(list, /addEventListener\?\.\(RESCHEDULED_EVENT, onScheduleMutation\)/);
assert.match(list, /removeEventListener\?\.\(RESCHEDULED_EVENT, onScheduleMutation\)/);

assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-reschedule.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-reschedule.css'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'PATCH',
  url: 'https://hafize.example/api/schedules/task-1',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'ignore', 'service worker must never cache PATCH');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/schedule-reschedule.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');

assert.match(source, /type = 'datetime-local'/);
assert.match(source, /aria-expanded/);
assert.match(source, /role', 'status'/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /event\?\.key !== 'Escape'/);
assert.match(source, /AUTO_MOUNT_TIMEOUT_MS = 10_000/);
assert.match(source, /observer\?\.disconnect/);
assert.match(source, /removeEventListener/);
assert.match(style, /min-height:\s*44px/);
assert.match(style, /focus-visible/);
assert.match(style, /prefers-reduced-motion:\s*reduce/);
assert.match(style, /forced-colors:\s*active/);
assert.match(policy, /schedule-reschedule\.css/);

console.log('schedule reschedule integration tests passed');
