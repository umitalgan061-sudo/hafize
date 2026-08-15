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
assert.equal(count('await GOOGLE_OAUTH_HTTP_RUNTIME.close();'), 1);
assert.equal(count('Hafize Google OAuth runtime shutdown failed'), 1);

const oauthRoute = source.indexOf("url.pathname === '/api/connectors/gmail/oauth/start'");
const staticRoute = source.indexOf("if (req.method === 'GET' || req.method === 'HEAD')");
assert.ok(oauthRoute > 0 && staticRoute > oauthRoute, 'OAuth routes must be handled before static fallback');

const healthLine = source.indexOf('googleOAuthConfigured: GOOGLE_OAUTH_HTTP_RUNTIME.configured');
assert.ok(healthLine > 0);
const healthWindow = source.slice(healthLine, healthLine + 200);
assert.equal(/TOKEN|SECRET|REDIS_URL/.test(healthWindow), false, 'health must expose configuration state, not credentials');

console.log('Google OAuth server mount tests passed');
