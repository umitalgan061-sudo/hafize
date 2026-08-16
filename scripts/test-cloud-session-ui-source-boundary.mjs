import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const clientSource = await readFile(new URL('../public/cloud-session-ui.js', import.meta.url), 'utf8');
const swSource = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const clientPath = fileURLToPath(new URL('../public/cloud-session-ui.js', import.meta.url));
const syntax = spawnSync(process.execPath, ['--check', clientPath], { cwd: root, encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || 'cloud-session-ui.js syntax failed');

function count(source, fragment) {
  return source.split(fragment).length - 1;
}

for (const id of [
  'accountConnectionCard',
  'sessionBadge',
  'sessionStatusText',
  'sessionLoginForm',
  'sessionPassword',
  'sessionLoginBtn',
  'sessionActions',
  'gmailConnectBtn',
  'sessionLogoutBtn',
  'gmailConnectionStatus'
]) assert.equal(count(html, `id="${id}"`), 1, `${id} must be unique`);

assert.equal(count(html, 'href="/cloud-session-ui.css"'), 1);
assert.equal(count(html, 'src="/cloud-session-ui.js"'), 1);
assert.match(html, /id="sessionPassword"[^>]*type="password"/);
assert.match(html, /id="sessionPassword"[^>]*autocomplete="current-password"/);
assert.match(html, /id="sessionPassword"[^>]*required/);
assert.equal(html.includes('HAFIZE_CONNECTOR_AUTH_TOKEN'), false);
assert.equal(html.includes('HAFIZE_CLOUD_SESSION_SIGNING_KEY'), false);
assert.equal(html.includes('HAFIZE_CLOUD_SESSION_PASSWORD_HASH'), false);

for (const forbidden of [
  'localStorage',
  'sessionStorage',
  'HAFIZE_CONNECTOR_AUTH_TOKEN',
  'HAFIZE_CONNECTOR_OWNER_KEY_B64',
  'HAFIZE_CLOUD_SESSION_PASSWORD_HASH',
  'HAFIZE_CLOUD_SESSION_SIGNING_KEY',
  "headers: { Authorization",
  "headers.Authorization",
  "request(PATHS.gmailCallback"
]) assert.equal(clientSource.includes(forbidden), false, `browser source must not contain ${forbidden}`);

assert.equal(clientSource.includes("credentials: 'same-origin'"), true);
assert.equal(clientSource.includes("cache: 'no-store'"), true);
assert.equal(clientSource.includes("hostname !== GOOGLE_HOST"), true);
assert.equal(clientSource.includes("url.protocol !== 'https:'"), true);
assert.equal(clientSource.includes("popup.location.replace(started.authorizationUrl)"), true);
assert.equal(clientSource.includes("url.pathname !== PATHS.gmailCallback"), true);

const sw = require('../public/sw-policy.js');
assert.equal(sw.CURRENT_CACHE, 'hafize-shell-v15');
assert.equal(sw.SHELL_ASSETS.includes('/cloud-session-ui.js'), true);
assert.equal(sw.SHELL_ASSETS.includes('/cloud-session-ui.css'), true);
const origin = 'https://hafize.example';
function get(path, { accept = 'application/json', mode = 'cors' } = {}) {
  return {
    method: 'GET',
    url: `${origin}${path}`,
    mode,
    headers: { get(name) { return name.toLowerCase() === 'accept' ? accept : ''; } }
  };
}
for (const path of [
  '/api/session/status',
  '/api/connectors/gmail/status',
  '/api/connectors/gmail/oauth/callback?state=opaque&code=opaque'
]) assert.equal(sw.classifyRequest(get(path), origin), 'network-only', `${path} must bypass cache`);
assert.equal(sw.classifyRequest(get('/cloud-session-ui.js', { accept: 'text/javascript' }), origin), 'shell');
assert.equal(sw.classifyRequest(get('/cloud-session-ui.css', { accept: 'text/css' }), origin), 'shell');
assert.equal(sw.classifyRequest(get('/index.html', { accept: 'text/html', mode: 'navigate' }), origin), 'navigation');
assert.equal(sw.classifyRequest({ ...get('/api/session/status'), method: 'POST' }, origin), 'ignore');

assert.equal(swSource.includes("pathname.startsWith('/api/')"), true);
console.log('cloud session UI source boundary tests passed');
