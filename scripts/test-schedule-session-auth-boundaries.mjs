import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const authPath = fileURLToPath(new URL('../lib/schedule-session-auth.mjs', import.meta.url));
const apiPath = fileURLToPath(new URL('../lib/schedule-http-api.mjs', import.meta.url));
const listPath = fileURLToPath(new URL('../public/schedule-list.js', import.meta.url));
const cloudPath = fileURLToPath(new URL('../lib/cloud-session-auth.mjs', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/SCHEDULE_CLOUD_SESSION_AUTH_BOUNDARY.md', import.meta.url));
const [authSource, apiSource, listSource, cloudSource, doc] = await Promise.all([
  readFile(authPath, 'utf8'),
  readFile(apiPath, 'utf8'),
  readFile(listPath, 'utf8'),
  readFile(cloudPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [authPath, apiPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax failed`);
}

assert.equal(apiSource.includes("from './schedule-session-auth.mjs'"), true);
assert.equal(apiSource.includes('createOptionalScheduleSessionAuthenticator()'), true);
assert.equal(apiSource.includes('authenticateSchedulePrincipal({'), true);
assert.equal(apiSource.includes('primaryAuthenticator: authenticator'), true);
assert.equal(apiSource.includes('sessionAuthenticator,'), true);
assert.equal(apiSource.includes("{ 'WWW-Authenticate': 'Bearer' }"), true, 'existing bearer challenge stays compatible');

assert.equal(listSource.includes("fetchImpl('/api/schedules'"), true);
assert.equal(listSource.includes("method: 'GET'"), true);
assert.equal(listSource.includes("credentials: 'same-origin'"), true);
assert.equal(listSource.includes("cache: 'no-store'"), true);

for (const forbidden of [
  /localStorage/,
  /sessionStorage/,
  /indexedDB/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /innerHTML/,
  /outerHTML/,
  /Authorization\s*:/,
  /Bearer\s+\$\{/,
  /process\.env\[[^\]]+\]\s*=/,
  /console\.(?:log|error)\s*\(/
]) {
  assert.equal(forbidden.test(authSource), false, `auth bridge must not add forbidden surface: ${forbidden}`);
}

assert.equal(authSource.includes('HAFIZE_CLOUD_SESSION_PASSWORD_HASH'), true);
assert.equal(authSource.includes('HAFIZE_CLOUD_SESSION_SIGNING_KEY'), true);
assert.equal(authSource.includes('HAFIZE_CLOUD_SESSION_SUBJECT'), true);
assert.equal(authSource.includes('HAFIZE_CLOUD_SESSION_ORIGIN'), true);
assert.equal(authSource.includes('HAFIZE_CLOUD_SESSION_TTL_MS'), true);
assert.equal(authSource.includes("url.protocol !== 'https:'"), true);
assert.equal(authSource.includes('ttlMs < 60_000'), true);
assert.equal(authSource.includes('ttlMs > 12 * 60 * 60 * 1000'), true);

assert.equal(cloudSource.includes("const COOKIE_NAME = '__Host-hafize_session'"), true);
assert.equal(cloudSource.includes('HttpOnly; Secure; SameSite=Strict'), true);
assert.equal(cloudSource.includes('timingSafeEqual'), true);
assert.equal(authSource.includes("import { createCloudSessionAuth } from './cloud-session-auth.mjs'"), true);

assert.match(doc, /bearer.*birinci|bearer.*önce/i);
assert.match(doc, /HttpOnly/i);
assert.match(doc, /owner/i);
assert.match(doc, /secret/i);
assert.match(doc, /POST\/PATCH\/DELETE/i);
assert.match(doc, /fail-closed/i);
assert.match(doc, /migration yok/i);

const sensitiveResponsePatterns = [
  /sendJson/,
  /response\([^\n]+signingKey/,
  /response\([^\n]+passwordHash/,
  /return[^\n]+signingKey/,
  /return[^\n]+passwordHash/
];
for (const pattern of sensitiveResponsePatterns) {
  assert.equal(pattern.test(authSource), false, `schedule session auth must not serialize credential config: ${pattern}`);
}

assert.equal(apiSource.includes('commands.list({ principal: auth.principal })'), true);
assert.equal(apiSource.includes('commands.create({ principal: auth.principal, input })'), true);
assert.equal(apiSource.includes('commands.reschedule({ principal: auth.principal, scheduleId, input })'), true);
assert.equal(apiSource.includes('commands.cancel({ principal: auth.principal, scheduleId })'), true);

console.log('schedule session auth boundary tests passed');
