import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');

const sourcePath = fileURLToPath(new URL('../public/conversation-organize.js', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/conversation-organize.css', import.meta.url));
const [source, loader, policySource, css] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(cssPath, 'utf8')
]);

for (const path of [sourcePath, loaderPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

const loaderNeedle = "loadShellEnhancement('HafizeConversationOrganize', '/conversation-organize.js', 'data-hafize-conversation-organize')";
assert.equal(loader.includes(loaderNeedle), true);
assert.equal(loader.split("'/conversation-organize.js'").length - 1, 1, 'organization enhancement must load exact-once');
assert.equal(source.includes("link.href = '/conversation-organize.css'"), true);
assert.equal(source.includes("data-hafize-conversation-organize-style"), true);

assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(swPolicy.SHELL_ASSETS.includes('/conversation-organize.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/conversation-organize.css'), true);
assert.equal(swPolicy.SHELL_ASSETS.filter((path) => path === '/conversation-organize.js').length, 1);
assert.equal(swPolicy.SHELL_ASSETS.filter((path) => path === '/conversation-organize.css').length, 1);
assert.equal(policySource.includes("'/conversation-organize.js'"), true);
assert.equal(policySource.includes("'/conversation-organize.css'"), true);

assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/conversation-organize.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/conversation-organize.css',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/api/chat',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'ignore');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/chat',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');

assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) auto auto/);
assert.match(css, /conversation-organize-actions/);
assert.match(css, /conversation-organize-editor/);

console.log('conversation organize integration tests passed');
