import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const guardSource = await readFile(new URL('../public/hands-free-background-guard.js', import.meta.url), 'utf8');

const consentIndex = index.indexOf('src="/hands-free-consent.js"');
const runtimeIndex = index.indexOf('src="/hands-free.js"');
const guardIndex = index.indexOf('src="/hands-free-background-guard.js"');
assert.ok(consentIndex >= 0, 'consent script must remain wired');
assert.ok(runtimeIndex > consentIndex, 'hands-free runtime must load after consent interception');
assert.ok(guardIndex > runtimeIndex, 'background guard must load after canonical runtime ownership');
assert.equal((index.match(/hands-free-background-guard\.js/g) || []).length, 1, 'guard must be wired exactly once');

assert.ok(swPolicy.SHELL_ASSETS.includes('/hands-free-background-guard.js'), 'PWA shell must cache the guard');
assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(
  swPolicy.classifyRequest({
    method: 'GET',
    url: 'https://hafize.test/hands-free-background-guard.js',
    headers: new Map(),
    mode: 'same-origin'
  }, 'https://hafize.test'),
  'shell'
);
assert.equal(
  swPolicy.classifyRequest({
    method: 'GET',
    url: 'https://hafize.test/api/agent/run',
    headers: new Map(),
    mode: 'same-origin'
  }, 'https://hafize.test'),
  'network-only',
  'microphone hardening must not weaken API cache isolation'
);

assert.match(guardSource, /addEventListener\?\.\('visibilitychange', onVisibilityChange, true\)/);
assert.match(guardSource, /addEventListener\?\.\('freeze', onFreeze, true\)/);
assert.match(guardSource, /addEventListener\?\.\('pagehide', onPageHide, true\)/);
assert.match(guardSource, /if \(documentRef\.hidden === true\) revoke\('hidden-at-install'\)/);
assert.doesNotMatch(guardSource, /\bfetch\s*\(/, 'guard must not create a network path');
assert.doesNotMatch(guardSource, /localStorage|sessionStorage|indexedDB/, 'guard must not persist microphone consent');
assert.doesNotMatch(guardSource, /innerHTML|insertAdjacentHTML/, 'guard must not add HTML injection surfaces');
assert.doesNotMatch(guardSource, /setTimeout|setInterval/, 'guard must not schedule hidden microphone reactivation');

console.log('hands-free background PWA wiring tests passed');