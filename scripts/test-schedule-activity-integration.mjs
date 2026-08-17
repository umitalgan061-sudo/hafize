import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');
const sourcePath = fileURLToPath(new URL('../public/schedule-activity.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/schedule-activity.css', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/SCHEDULE_ACTIVITY_VIEW_CONTRACT.md', import.meta.url));

const [source, style, loader, policy, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [sourcePath, loaderPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /indexedDB/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\binnerHTML\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/,
  /Authorization/i,
  /Bearer\s/i,
  /raw\.lastError/,
  /raw\.traceId/,
  /raw\.ownerId/,
  /raw\.task/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `activity view exposes forbidden surface: ${forbidden}`);
}

assert.match(source, /method:\s*'GET'/);
assert.match(source, /credentials:\s*'same-origin'/);
assert.match(source, /cache:\s*'no-store'/);
assert.match(source, /new root\.MutationObserver/);
assert.match(source, /attributeFilter:\s*\['data-state'\]/);
assert.match(source, /pendingRefresh/);
assert.match(source, /createElement\('progress'\)/);
assert.match(source, /aria-pressed/);
assert.match(source, /textContent/);

assert.match(loader, /HafizeScheduleActivity/);
assert.match(loader, /\/schedule-activity\.js/);
assert.equal(loader.split("'/schedule-activity.js'").length - 1, 1);
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v70');
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-activity.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-activity.css'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/schedule-activity.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/schedules',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/api/schedules',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'ignore');

assert.match(style, /schedule-activity-filter\[aria-pressed="true"\]/);
assert.match(style, /min-height:\s*40px/);
assert.match(style, /prefers-reduced-motion:\s*reduce/);
assert.match(style, /forced-colors:\s*active/);
assert.match(doc, /lastError/);
assert.match(doc, /traceId/);
assert.match(doc, /GET \/api\/schedules/);
assert.match(doc, /storage'a yazılmaz/i);

console.log('schedule activity integration tests passed');
