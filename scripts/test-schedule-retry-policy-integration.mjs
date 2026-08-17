import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');

const paths = {
  source: fileURLToPath(new URL('../public/schedule-retry-policy.js', import.meta.url)),
  style: fileURLToPath(new URL('../public/schedule-retry-policy.css', import.meta.url)),
  loader: fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url)),
  list: fileURLToPath(new URL('../public/schedule-list.js', import.meta.url)),
  boundary: fileURLToPath(new URL('../lib/schedule-command-boundary.mjs', import.meta.url)),
  api: fileURLToPath(new URL('../lib/schedule-http-api.mjs', import.meta.url)),
  doc: fileURLToPath(new URL('../docs/SCHEDULE_RETRY_POLICY_UI_CONTRACT.md', import.meta.url))
};
const [source, style, loader, list, boundary, api, doc] = await Promise.all(
  Object.values(paths).map((path) => readFile(path, 'utf8'))
);

assert.match(loader, /loadShellEnhancement\('HafizeScheduleRetryPolicy', '\/schedule-retry-policy\.js', 'data-hafize-schedule-retry-policy'\)/);
assert.equal(loader.split("'/schedule-retry-policy.js'").length - 1, 1, 'retry policy loader must be exact-once');
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v69');
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-retry-policy.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-retry-policy.css'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET', url: 'https://hafize.example/schedule-retry-policy.js', headers: {}, mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'PATCH', url: 'https://hafize.example/api/schedules/schedule_1', headers: {}, mode: 'cors'
}, 'https://hafize.example'), 'ignore', 'service worker must never cache schedule mutations');

assert.match(list, /article\.dataset\.maxAttempts = String\(item\.maxAttempts\)/);
assert.match(source, /maxAttemptsFor\(article\) > 1/);
assert.match(boundary, /const RESCHEDULE_FIELDS = new Set\(\['runAt', 'retryDelayMs'\]\)/);
assert.match(boundary, /current\.status !== 'scheduled'/);
assert.match(boundary, /current\.ownerId !== ownerId/);
assert.match(boundary, /store\.reschedule\(owned\.id/);
assert.match(api, /if \(!root && verb === 'PATCH'\)/);
assert.match(api, /commands\.reschedule\(\{ principal: auth\.principal, scheduleId, input \}\)/);

assert.match(style, /min-height: 44px/);
assert.match(style, /prefers-reduced-motion: reduce/);
assert.match(style, /forced-colors: active/);
assert.match(source, /setAttribute\('aria-expanded', 'false'\)/);
assert.match(source, /setAttribute\('aria-live', 'polite'\)/);
assert.match(source, /new root\.MutationObserver/);
assert.match(source, /AUTO_MOUNT_TIMEOUT_MS/);

assert.match(doc, /açık confirmation/i);
assert.match(doc, /default-deny/i);
assert.match(doc, /owner/i);
assert.match(doc, /localStorage/i);
assert.match(doc, /24 saat/i);
assert.doesNotMatch(doc, /500 satır/i);

console.log('schedule retry policy integration tests passed');
