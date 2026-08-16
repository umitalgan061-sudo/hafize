import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const [loader, policySource] = await Promise.all([
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8')
]);

assert.equal(
  loader.includes("loadShellEnhancement('HafizeConversationOutline', '/conversation-outline.js', 'data-hafize-conversation-outline')"),
  true,
  'conversation outline loader wiring missing'
);
assert.equal(loader.split("'/conversation-outline.js'").length - 1, 1, 'outline loader must be exact-once');

const marker = "const CURRENT_CACHE = `${CACHE_PREFIX}v62`;";
assert.equal(policySource.includes(marker), true, 'PWA cache must advance to v62');
assert.equal(policySource.includes("'/conversation-outline.js'"), true);
assert.equal(policySource.includes("'/conversation-outline.css'"), true);

const requirePolicy = await import('node:module').then(({ createRequire }) => createRequire(import.meta.url));
const policy = requirePolicy('../public/sw-policy.js');
assert.equal(policy.CURRENT_CACHE, 'hafize-shell-v62');
assert.equal(policy.SHELL_ASSETS.includes('/conversation-outline.js'), true);
assert.equal(policy.SHELL_ASSETS.includes('/conversation-outline.css'), true);
assert.equal(policy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/conversation-outline.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(policy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/chat',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');
assert.equal(policy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/conversation-outline.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'ignore');

console.log('conversation outline integration tests passed');
