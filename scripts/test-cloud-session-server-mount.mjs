import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
const source = await readFile(serverPath, 'utf8');
const syntax = spawnSync(process.execPath, ['--check', serverPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || 'server.mjs syntax check failed');

function count(fragment) {
  return source.split(fragment).length - 1;
}

assert.equal(count("import { createCloudSessionNodeServerRuntime } from './lib/cloud-session-node-server-runtime.mjs';"), 1);
assert.equal(count('const CLOUD_SESSION_NODE_SERVER_RUNTIME = createCloudSessionNodeServerRuntime({ env: process.env });'), 1);
assert.equal(count('cloudSessionConfigured: CLOUD_SESSION_NODE_SERVER_RUNTIME.configured'), 1);
for (const pathname of ['/api/session/login', '/api/session/status', '/api/session/logout']) {
  assert.equal(count(`url.pathname === '${pathname}'`), 1, `${pathname} must be mounted exactly once`);
}
assert.equal(count('const sessionResponse = await CLOUD_SESSION_NODE_SERVER_RUNTIME.handle({'), 1);
assert.equal(count("for (const [name, value] of Object.entries(sessionResponse.headers || {})) res.setHeader(name, value);"), 1);
assert.equal(count('sendJson(res, sessionResponse.status, sessionResponse.body);'), 1);

const route = source.indexOf("url.pathname === '/api/session/login'");
const oauthRoute = source.indexOf("url.pathname === '/api/connectors/gmail/oauth/start'");
const staticRoute = source.indexOf("if (req.method === 'GET' || req.method === 'HEAD')");
assert.ok(route > 0 && oauthRoute > route, 'session routes must be explicit before connector/static routing');
assert.ok(staticRoute > oauthRoute, 'session routes must never fall through to static content');

const routeWindow = source.slice(route, route + 1100);
for (const forwarded of ['request: req', 'method: req.method', 'pathname: url.pathname', 'headers: req.headers']) {
  assert.equal(routeWindow.includes(forwarded), true, `session dispatch must forward ${forwarded}`);
}
assert.equal(routeWindow.includes('sendJson(res, sessionResponse.status, sessionResponse.body);'), true);

const healthLine = source.indexOf('cloudSessionConfigured: CLOUD_SESSION_NODE_SERVER_RUNTIME.configured');
const healthWindow = source.slice(healthLine, healthLine + 260);
assert.equal(/PASSWORD|SIGNING|SUBJECT|ORIGIN|COOKIE|TOKEN|SECRET/.test(healthWindow), false, 'health must not expose session credential/config detail');

const initLine = source.indexOf('const CLOUD_SESSION_NODE_SERVER_RUNTIME = createCloudSessionNodeServerRuntime({ env: process.env });');
const listenLine = source.indexOf('server.listen(PORT, HOST');
assert.ok(initLine > 0 && listenLine > initLine, 'session config must fail closed before HTTP listen begins');

console.log('cloud session server mount tests passed');
