import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runtimePath = fileURLToPath(new URL('../lib/google-oauth-http-runtime.mjs', import.meta.url));
const runtime = await readFile(runtimePath, 'utf8');
const syntax = spawnSync(process.execPath, ['--check', runtimePath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || 'Google OAuth runtime syntax failed');

for (const forbidden of [
  'createBearerPrincipalAuthenticator',
  "const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN'",
  "const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT'",
  'createAuthenticator = createBearerPrincipalAuthenticator'
]) {
  assert.equal(runtime.includes(forbidden), false, `legacy OAuth start authentication must stay removed: ${forbidden}`);
}

for (const required of [
  "import { createCloudSessionNodeServerRuntime } from './cloud-session-node-server-runtime.mjs';",
  "const SESSION_ORIGIN_ENV = 'HAFIZE_CLOUD_SESSION_ORIGIN';",
  "const sessionRuntime = requireFactory(createSessionRuntime, 'createSessionRuntime')({ env });",
  'const authenticator = sessionRuntime?.authenticator;',
  "if (!sessionRuntime?.configured || typeof authenticator?.authenticate !== 'function')",
  "if (headerValue(headers, 'origin') !== startOrigin) fail('GOOGLE_OAUTH_HTTP_ORIGIN_REQUIRED');",
  'const principal = authenticate(headers);',
  'const ownership = ownerResolver.resolve(principal);',
  'const ownerId = normalizeOAuthFlowOwnerId(ownership?.ownerId, { required: true });',
  'requireRefreshToken: true'
]) {
  assert.equal(runtime.includes(required), true, `missing OAuth cloud-session invariant: ${required}`);
}

const startBegin = runtime.indexOf('async function handleStart');
const callbackBegin = runtime.indexOf('async function handleCallback');
assert.ok(startBegin > 0 && callbackBegin > startBegin);
const start = runtime.slice(startBegin, callbackBegin);
const originCheck = start.indexOf("headerValue(headers, 'origin') !== startOrigin");
const authentication = start.indexOf('const principal = authenticate(headers);');
const ownerResolution = start.indexOf('const ownership = ownerResolver.resolve(principal);');
const bodyRead = start.indexOf('const body = await readStartJson');
const stateIssue = start.indexOf('const started = await oauthRuntime.start');
assert.ok(originCheck >= 0 && authentication > originCheck, 'exact Origin must be checked before cookie authentication');
assert.ok(ownerResolution > authentication, 'owner must derive from authenticated session principal');
assert.ok(bodyRead > ownerResolution, 'request body must be read only after authentication/ownership');
assert.ok(stateIssue > bodyRead, 'OAuth state must be issued only after the authenticated request is validated');

const callbackEnd = runtime.indexOf('async function handle(', callbackBegin);
const callback = runtime.slice(callbackBegin, callbackEnd);
assert.equal(callback.includes('authenticate(headers)'), false, 'provider callback must not depend on browser cookie');
assert.equal(callback.includes('headerValue(headers'), false, 'provider callback must not require browser Origin headers');
assert.equal(callback.includes('finished.ownerId'), true, 'callback owner must come from consumed server-side flow state');
assert.equal(callback.includes('tokenExchange.exchange'), true);
assert.equal(callback.includes('requireRefreshToken: true'), true, 'linked grants must remain durable/offline');

const publicError = runtime.slice(runtime.indexOf('function publicError'), runtime.indexOf('export async function createGoogleOAuthHttpRuntime'));
assert.equal(publicError.includes("GOOGLE_OAUTH_HTTP_ORIGIN_REQUIRED') return result(403, { error: 'ORIGIN_REQUIRED' })"), true);
assert.equal(publicError.includes('HAFIZE_CONNECTOR_AUTH_TOKEN'), false);

console.log('Google OAuth cloud-session source boundary tests passed');
