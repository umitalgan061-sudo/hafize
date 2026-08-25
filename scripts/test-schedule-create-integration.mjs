import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');

const paths = {
  source: fileURLToPath(new URL('../public/schedule-create.js', import.meta.url)),
  css: fileURLToPath(new URL('../public/schedule-create.css', import.meta.url)),
  listCss: fileURLToPath(new URL('../public/schedule-list.css', import.meta.url)),
  loader: fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url)),
  policy: fileURLToPath(new URL('../public/sw-policy.js', import.meta.url)),
  api: fileURLToPath(new URL('../lib/schedule-http-api.mjs', import.meta.url)),
  boundary: fileURLToPath(new URL('../lib/schedule-command-boundary.mjs', import.meta.url))
};

const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')]));
const source = Object.fromEntries(entries);

for (const path of [paths.source, paths.loader, paths.policy]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax failed`);
}

assert.equal(source.loader.includes("loadShellEnhancement('HafizeScheduleList', '/schedule-list.js', 'data-hafize-schedule-list')"), true);
assert.equal(source.loader.includes("loadShellEnhancement('HafizeScheduleCreate', '/schedule-create.js', 'data-hafize-schedule-create')"), true);
assert.equal(source.loader.indexOf("'/schedule-list.js'") < source.loader.indexOf("'/schedule-create.js'"), true, 'list card must load before form enhancement');
assert.equal(source.loader.split("'/schedule-create.js'").length - 1, 1);

assert.equal(source.listCss.startsWith("@import url('/schedule-create.css');"), true);
assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-create.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/schedule-create.css'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/schedule-create.js',
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
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'ignore', 'service worker must never cache POST schedule mutations');

assert.match(source.api, /root && verb === 'POST'/);
assert.match(source.api, /commands\.create\(\{ principal: auth\.principal, input \}\)/);
assert.match(source.boundary, /const CREATE_FIELDS = new Set\(\['agentId', 'task', 'runAt', 'maxAttempts', 'retryDelayMs'\]\)/);
assert.match(source.boundary, /registry\.agents\.find/);
assert.match(source.boundary, /ownerId/);
assert.match(source.boundary, /createTraceId/);

assert.match(source.source, /const MAX_TASK_CHARS = 4000/);
assert.match(source.source, /const MAX_ATTEMPTS = 5/);
assert.match(source.source, /nodes\.form\.addEventListener\('submit', onSubmit\)/);
assert.match(source.source, /method: 'POST'/);
assert.match(source.source, /Content-Type': 'application\/json'/);
assert.match(source.source, /credentials: 'same-origin'/);
assert.match(source.source, /cache: 'no-store'/);
assert.match(source.source, /JSON\.stringify\(input\)/);
assert.match(source.source, /result\.status === 401/);
assert.match(source.source, /result\.status === 400/);
assert.match(source.source, /result\.status === 503/);
assert.match(source.source, /nodes\.form\.reset\(\)/);
assert.match(source.source, /new root\.CustomEvent\(CREATED_EVENT\)/);

const forbiddenMutationMethods = [/method:\s*'PATCH'/, /method:\s*'DELETE'/, /method:\s*'PUT'/];
for (const pattern of forbiddenMutationMethods) {
  assert.equal(pattern.test(source.source), false, `create UI must not expose unrelated mutation method: ${pattern}`);
}

for (const forbiddenField of ['traceId', 'ownerId', 'retryDelayMs', 'lastError', 'passwordHash', 'signingKey']) {
  const bodyBuilderStart = source.source.indexOf('function buildCreateInput');
  const bodyBuilderEnd = source.source.indexOf('async function readPayload');
  const bodyBuilder = source.source.slice(bodyBuilderStart, bodyBuilderEnd);
  assert.equal(bodyBuilder.includes(forbiddenField), false, `client create body must not generate ${forbiddenField}`);
}

assert.match(source.css, /schedule-create-note/);
assert.match(source.css, /schedule-create-status/);
assert.match(source.css, /min-height: 44px/);
assert.match(source.css, /prefers-reduced-motion/);
assert.match(source.css, /forced-colors: active/);

console.log('schedule create integration tests passed');
