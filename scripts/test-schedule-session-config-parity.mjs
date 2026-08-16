import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const scheduleAuthPath = fileURLToPath(new URL('../lib/schedule-session-auth.mjs', import.meta.url));
const cloudRuntimePath = fileURLToPath(new URL('../lib/cloud-session-node-server-runtime.mjs', import.meta.url));
const cloudAuthPath = fileURLToPath(new URL('../lib/cloud-session-auth.mjs', import.meta.url));
const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
const [scheduleAuth, cloudRuntime, cloudAuth, server] = await Promise.all([
  readFile(scheduleAuthPath, 'utf8'),
  readFile(cloudRuntimePath, 'utf8'),
  readFile(cloudAuthPath, 'utf8'),
  readFile(serverPath, 'utf8')
]);

const envNames = [
  'HAFIZE_CLOUD_SESSION_PASSWORD_HASH',
  'HAFIZE_CLOUD_SESSION_SIGNING_KEY',
  'HAFIZE_CLOUD_SESSION_SUBJECT',
  'HAFIZE_CLOUD_SESSION_ORIGIN',
  'HAFIZE_CLOUD_SESSION_TTL_MS'
];
for (const name of envNames) {
  assert.equal(scheduleAuth.includes(name), true, `schedule auth must share ${name}`);
  assert.equal(cloudRuntime.includes(name), true, `cloud runtime must define ${name}`);
}

assert.equal(scheduleAuth.includes("import { createCloudSessionAuth } from './cloud-session-auth.mjs'"), true);
assert.equal(cloudRuntime.includes("import { createCloudSessionAuth } from './cloud-session-auth.mjs'"), true);
assert.equal(scheduleAuth.includes("url.protocol !== 'https:'"), true);
assert.equal(cloudRuntime.includes('allowedOrigin'), true);
assert.equal(cloudAuth.includes("const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000"), true);
assert.equal(cloudAuth.includes("const MAX_TTL_MS = 12 * 60 * 60 * 1000"), true);
assert.equal(scheduleAuth.includes('ttlMs < 60_000'), true);
assert.equal(scheduleAuth.includes('ttlMs > 12 * 60 * 60 * 1000'), true);

assert.equal(server.includes('const CLOUD_SESSION_NODE_SERVER_RUNTIME = createCloudSessionNodeServerRuntime({ env: process.env });'), true);
assert.equal(server.includes('const SCHEDULE_AUTHENTICATOR = createOptionalScheduleAuthenticator();'), true);
assert.equal(server.includes('createScheduleHttpApi({ authenticator: SCHEDULE_AUTHENTICATOR, commands: SCHEDULE_COMMANDS, readJson })'), true);
assert.equal(server.includes("url.pathname === '/api/schedules'"), true);
assert.equal(server.includes('scheduleApiConfigured: Boolean(SCHEDULE_HTTP_API)'), true);

assert.equal(scheduleAuth.includes('createOptionalScheduleSessionAuthenticator'), true);
assert.equal(scheduleAuth.includes('if (!configured) return null'), true, 'disabled cloud session must preserve bearer-only mode');
assert.equal(scheduleAuth.includes("fail('INVALID_SCHEDULE_SESSION_AUTH:partialConfig')"), true, 'partial config must fail closed');
assert.equal(scheduleAuth.includes('primaryAuthenticator.authenticate'), true);
assert.equal(scheduleAuth.indexOf('primaryAuthenticator.authenticate'), scheduleAuth.lastIndexOf('primaryAuthenticator.authenticate'));
assert.equal(scheduleAuth.includes('sessionAuthenticator?.authenticate'), true);

for (const forbidden of [
  'HAFIZE_SCHEDULE_AUTH_TOKEN',
  'HAFIZE_SCHEDULE_AUTH_SUBJECT',
  'GITHUB_TOKEN',
  'NVIDIA_API_KEY',
  'CANVA_CLIENT_SECRET',
  'GOOGLE_CLIENT_SECRET'
]) {
  assert.equal(scheduleAuth.includes(forbidden), false, `cloud fallback must not couple to unrelated secret ${forbidden}`);
}

console.log('schedule/cloud-session configuration parity tests passed');
