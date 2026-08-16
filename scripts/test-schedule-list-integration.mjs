import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const sourcePath = fileURLToPath(new URL('../public/schedule-list.js', import.meta.url));
const [loader, policy, source] = await Promise.all([
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(sourcePath, 'utf8')
]);

for (const path of [loaderPath, policyPath, sourcePath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax failed`);
}

const loaderNeedle = "loadShellEnhancement('HafizeScheduleList', '/schedule-list.js', 'data-hafize-schedule-list')";
assert.equal(loader.includes(loaderNeedle), true);
assert.equal(loader.split("'/schedule-list.js'").length - 1, 1, 'schedule list loader must be exact-once');
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v65');
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-list.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-list.css'), true);
assert.equal(policy.includes("'/schedule-list.js'"), true);
assert.equal(policy.includes("'/schedule-list.css'"), true);

const origin = 'https://hafize.example';
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: `${origin}/schedule-list.js`,
  headers: {},
  mode: 'cors'
}, origin), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: `${origin}/schedule-list.css`,
  headers: {},
  mode: 'cors'
}, origin), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: `${origin}/api/schedules`,
  headers: { accept: 'application/json' },
  mode: 'cors'
}, origin), 'network-only');
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: `${origin}/api/schedules`,
  headers: { accept: 'application/json' },
  mode: 'cors'
}, origin), 'ignore');

assert.match(source, /documentRef\.querySelector\?\('\.utility-rail'\)/);
assert.match(source, /documentRef\.querySelector\?\('#sessionBadge'\)/);
assert.match(source, /new root\.MutationObserver/);
assert.match(source, /refresh\(\{ reason: 'mount' \}\)/);
assert.match(source, /nodes\.refresh\.addEventListener\('click', onRefresh\)/);
assert.match(source, /nodes\.refresh\.removeEventListener\('click', onRefresh\)/);
assert.match(source, /nodes\.card\.remove\(\)/);

console.log('schedule list integration tests passed');
