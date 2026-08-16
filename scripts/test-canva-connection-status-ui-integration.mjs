import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');
const [loader, source, styleLoader, css, server] = await Promise.all([
  readFile(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/canva-connection-status.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/canva-connection-status-style.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/canva-connection-status.css', import.meta.url), 'utf8'),
  readFile(new URL('../server.mjs', import.meta.url), 'utf8')
]);

const statusLoader = "loadShellEnhancement('HafizeCanvaConnectionStatus', '/canva-connection-status.js', 'data-hafize-canva-connection-status')";
const styleLoaderCall = "loadShellEnhancement('HafizeCanvaConnectionStatusStyle', '/canva-connection-status-style.js', 'data-hafize-canva-connection-status-style-loader')";
assert.equal(loader.includes(statusLoader), true);
assert.equal(loader.includes(styleLoaderCall), true);
assert.equal(loader.split("'/canva-connection-status.js'").length - 1, 1);
assert.equal(loader.split("'/canva-connection-status-style.js'").length - 1, 1);

assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v63');
for (const asset of [
  '/canva-connection-status.js',
  '/canva-connection-status-style.js',
  '/canva-connection-status.css'
]) {
  assert.equal(swPolicy.SHELL_ASSETS.includes(asset), true, `${asset} must be offline shell asset`);
  assert.equal(swPolicy.classifyRequest({
    method: 'GET',
    url: `https://hafize.example${asset}`,
    headers: {},
    mode: 'cors'
  }, 'https://hafize.example'), 'shell');
}

assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/connectors/canva/status',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/health',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');

assert.equal(source.includes("const HEALTH_PATH = '/api/health'"), true);
assert.equal(source.includes("const STATUS_PATH = '/api/connectors/canva/status'"), true);
assert.equal(source.includes("credentials: 'same-origin'"), true);
assert.equal(source.includes("cache: 'no-store'"), true);
assert.equal(source.includes("statusResponse?.status === 401"), true);
assert.equal(source.includes('if (!health.canvaReadConfigured)'), true);
assert.equal(source.includes('Salt-okunur bağlantı'), true);

assert.equal(styleLoader.includes("const HREF = '/canva-connection-status.css'"), true);
assert.equal(styleLoader.includes("data-hafize-canva-connection-status-style"), true);
assert.equal(css.includes('@media (max-width: 520px)'), true);
assert.equal(css.includes('@media (prefers-reduced-motion: reduce)'), true);
assert.equal(css.includes('@media (forced-colors: active)'), true);
assert.equal(css.includes('.canva-connection-refresh:focus-visible'), true);

assert.equal(server.includes("url.pathname === '/api/connectors/canva/status'"), true);
assert.equal(server.includes('CANVA_AGENT_RUNTIME.connectionStatus({ headers: req.headers })'), true);
assert.equal(server.includes("status.error === 'AUTH_REQUIRED' ? 401 : 404"), true);
assert.equal(server.includes('sendJson(res, 200, { linked: status.linked })'), true);
assert.equal(server.includes('canvaReadConfigured: CANVA_AGENT_RUNTIME.configured'), true);

console.log('Canva connection status UI integration tests passed');
