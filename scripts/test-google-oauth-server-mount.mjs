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

assert.equal(count("import { createGoogleOAuthHttpRuntime } from './lib/google-oauth-http-runtime.mjs';"), 1);
assert.equal(count('const GOOGLE_OAUTH_HTTP_RUNTIME = await createGoogleOAuthHttpRuntime({ env: process.env, fetchImpl: fetch, readJson });'), 1);
assert.equal(count('googleOAuthConfigured: GOOGLE_OAUTH_HTTP_RUNTIME.configured'), 1);
assert.equal(count("url.pathname === '/api/connectors/gmail/oauth/start'"), 1);
assert.equal(count("url.pathname === '/api/connectors/gmail/oauth/callback'"), 1);
assert.equal(count('const oauthResponse = await GOOGLE_OAUTH_HTTP_RUNTIME.handle({'), 1);
assert.equal(count("for (const [name, value] of Object.entries(oauthResponse.headers || {})) res.setHeader(name, value);"), 1,
  'OAuth runtime response headers must reach the Node HTTP response');
assert.equal(count('sendJson(res, oauthResponse.status, oauthResponse.body);'), 1);
assert.equal(count('await GOOGLE_OAUTH_HTTP_RUNTIME.close();'), 1);
assert.equal(count('Hafize Google OAuth runtime shutdown failed'), 1);

const oauthRoute = source.indexOf("url.pathname === '/api/connectors/gmail/oauth/start'");
const gmailStatusRoute = source.indexOf("url.pathname === '/api/connectors/gmail/status'");
const staticRoute = source.indexOf("if (req.method === 'GET' || req.method === 'HEAD')");
assert.ok(oauthRoute > 0 && staticRoute > oauthRoute, 'OAuth routes must be handled before static fallback');
assert.ok(gmailStatusRoute > oauthRoute, 'OAuth dispatch must remain an explicit connector route, not static content');

const routeWindow = source.slice(oauthRoute, oauthRoute + 900);
for (const forwarded of ['request: req', 'method: req.method', 'pathname: url.pathname', 'url,', 'headers: req.headers']) {
  assert.equal(routeWindow.includes(forwarded), true, `OAuth dispatch must forward ${forwarded}`);
}
assert.equal(routeWindow.includes('sendJson(res, oauthResponse.status, oauthResponse.body);'), true);

const healthLine = source.indexOf('googleOAuthConfigured: GOOGLE_OAUTH_HTTP_RUNTIME.configured');
assert.ok(healthLine > 0);
const healthWindow = source.slice(healthLine, healthLine + 200);
assert.equal(/TOKEN|SECRET|REDIS_URL/.test(healthWindow), false, 'health must expose configuration state, not credentials');

const httpClose = source.indexOf('await httpClose;');
const oauthClose = source.indexOf('await GOOGLE_OAUTH_HTTP_RUNTIME.close();');
const gmailClose = source.indexOf('await GMAIL_AGENT_RUNTIME.close();');
assert.ok(httpClose > 0 && oauthClose > httpClose, 'HTTP listener must stop before OAuth Redis shutdown');
assert.ok(gmailClose > oauthClose, 'OAuth flow runtime cleanup must finish before Gmail refresh runtime cleanup');

console.log('Google OAuth server mount tests passed');
