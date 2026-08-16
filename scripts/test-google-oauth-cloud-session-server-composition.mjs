import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
const runtimePath = fileURLToPath(new URL('../lib/google-oauth-http-runtime.mjs', import.meta.url));
const disconnectPath = fileURLToPath(new URL('../lib/google-disconnect-http-runtime.mjs', import.meta.url));
const [server, runtime] = await Promise.all([
  readFile(serverPath, 'utf8'),
  readFile(runtimePath, 'utf8')
]);

for (const file of [serverPath, runtimePath, disconnectPath]) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${file} syntax check failed`);
}

const sessionInit = server.indexOf('const CLOUD_SESSION_NODE_SERVER_RUNTIME = createCloudSessionNodeServerRuntime({ env: process.env });');
const disconnectInit = server.indexOf('const GOOGLE_DISCONNECT_HTTP_RUNTIME = createGoogleDisconnectHttpRuntime({ env: process.env, fetchImpl: fetch });');
const oauthInit = server.indexOf('const GOOGLE_OAUTH_HTTP_RUNTIME = await createGoogleOAuthHttpRuntime({ env: process.env, fetchImpl: fetch, readJson });');
assert.ok(sessionInit > 0, 'server must initialize the cloud-session runtime');
assert.ok(disconnectInit > sessionInit, 'cloud-session bootstrap must occur before Google disconnect bootstrap');
assert.ok(oauthInit > sessionInit, 'cloud-session bootstrap must occur before Google OAuth bootstrap');
assert.equal(runtime.includes('createSessionRuntime = createCloudSessionNodeServerRuntime'), true,
  'Google OAuth must default its start authenticator to the cloud-session runtime');

const disconnectStart = server.indexOf("url.pathname === '/api/connectors/gmail/disconnect'");
const routeStart = server.indexOf("url.pathname === '/api/connectors/gmail/oauth/start'");
const routeEnd = server.indexOf("url.pathname === '/api/connectors/gmail/status'", routeStart);
assert.ok(disconnectStart > 0 && routeStart > disconnectStart && routeEnd > routeStart);
const disconnectRoute = server.slice(disconnectStart, routeStart);
for (const forwarded of ['request: req', 'method: req.method', 'pathname: url.pathname', 'url,', 'headers: req.headers']) {
  assert.equal(disconnectRoute.includes(forwarded), true, `disconnect server dispatch must forward ${forwarded}`);
}
const route = server.slice(routeStart, routeEnd);
for (const forwarded of ['request: req', 'method: req.method', 'pathname: url.pathname', 'url,', 'headers: req.headers']) {
  assert.equal(route.includes(forwarded), true, `OAuth server dispatch must forward ${forwarded}`);
}
assert.equal(route.includes('authorization:'), false, 'server must not synthesize connector Authorization for OAuth start');
assert.equal(route.includes('HAFIZE_CONNECTOR_AUTH_TOKEN'), false, 'connector bearer secret must not enter OAuth route wiring');
assert.equal(route.includes('HAFIZE_CONNECTOR_AUTH_SUBJECT'), false);

const healthStart = server.indexOf("if (req.method === 'GET' && url.pathname === '/api/health')");
const healthEnd = server.indexOf("if (url.pathname === '/api/skills')", healthStart);
const health = server.slice(healthStart, healthEnd);
assert.equal(health.includes('cloudSessionConfigured: CLOUD_SESSION_NODE_SERVER_RUNTIME.configured'), true);
assert.equal(health.includes('googleOAuthConfigured: GOOGLE_OAUTH_HTTP_RUNTIME.configured'), true);
assert.equal(health.includes('googleDisconnectConfigured: GOOGLE_DISCONNECT_HTTP_RUNTIME.configured'), true);
assert.equal(/PASSWORD_HASH|SIGNING_KEY|AUTH_TOKEN|OWNER_KEY|CLIENT_SECRET/.test(health), false,
  'health must expose configuration booleans only, never authentication material');

const oauthImport = server.indexOf("import { createGoogleOAuthHttpRuntime } from './lib/google-oauth-http-runtime.mjs';");
const disconnectImport = server.indexOf("import { createGoogleDisconnectHttpRuntime } from './lib/google-disconnect-http-runtime.mjs';");
const sessionImport = server.indexOf("import { createCloudSessionNodeServerRuntime } from './lib/cloud-session-node-server-runtime.mjs';");
assert.ok(sessionImport > 0 && oauthImport > 0 && disconnectImport > 0);
assert.equal(server.split("import { createGoogleOAuthHttpRuntime } from './lib/google-oauth-http-runtime.mjs';").length - 1, 1);
assert.equal(server.split("import { createGoogleDisconnectHttpRuntime } from './lib/google-disconnect-http-runtime.mjs';").length - 1, 1);
assert.equal(server.split("import { createCloudSessionNodeServerRuntime } from './lib/cloud-session-node-server-runtime.mjs';").length - 1, 1);
assert.equal(server.includes('await GOOGLE_DISCONNECT_HTTP_RUNTIME.close();'), true, 'disconnect runtime must close on shutdown');

console.log('Google OAuth cloud-session server composition tests passed');
