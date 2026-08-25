import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const handsFree = await readFile(new URL('../public/hands-free.js', import.meta.url), 'utf8');
const consent = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');

assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(swPolicy.SHELL_ASSETS.filter((asset) => asset === '/hands-free.js').length, 1);
assert.equal(swPolicy.SHELL_ASSETS.filter((asset) => asset === '/hands-free-consent.js').length, 1);
assert.equal(swPolicy.SHELL_ASSETS.includes('/hands-free.css'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/hands-free-consent.css'), true);

const origin = 'https://hafize.example';
const shellRequest = {
  method: 'GET',
  mode: 'same-origin',
  url: `${origin}/hands-free.js`,
  headers: { accept: 'text/javascript' }
};
assert.equal(swPolicy.classifyRequest(shellRequest, origin), 'shell');
assert.equal(swPolicy.classifyRequest({ ...shellRequest, url: `${origin}/hands-free-consent.js` }, origin), 'shell');
assert.equal(swPolicy.classifyRequest({ ...shellRequest, url: `${origin}/api/agent/run` }, origin), 'network-only');
assert.equal(swPolicy.classifyRequest({ ...shellRequest, url: `${origin}/api/chat` }, origin), 'network-only');
assert.equal(swPolicy.classifyRequest({ ...shellRequest, url: 'https://other.example/hands-free.js' }, origin), 'ignore');
assert.equal(swPolicy.classifyRequest({ ...shellRequest, method: 'POST' }, origin), 'ignore');
assert.equal(swPolicy.classifyRequest({ ...shellRequest, headers: { range: 'bytes=0-4' } }, origin), 'ignore');

const consentIndex = html.indexOf('<script src="/hands-free-consent.js" defer></script>');
const runtimeIndex = html.indexOf('<script src="/hands-free.js" defer></script>');
assert.ok(consentIndex >= 0, 'hands-free consent asset must remain in the app shell');
assert.ok(runtimeIndex > consentIndex, 'explicit consent layer must load before the hands-free runtime');
assert.equal((html.match(/<script src="\/hands-free\.js" defer><\/script>/g) || []).length, 1);
assert.equal((html.match(/<script src="\/hands-free-consent\.js" defer><\/script>/g) || []).length, 1);

assert.match(consent, /Onayla ve dinlemeyi aç/);
assert.match(consent, /event\?\.preventDefault\?\.\(\)/);
assert.match(consent, /event\?\.stopImmediatePropagation\?\.\(\)/);
assert.match(consent, /controller\?\.enable\?\.\(\)/);
assert.doesNotMatch(consent, /fetch\s*\(/);

assert.match(handsFree, /SESSION_LIMIT_MS\s*=\s*30 \* 60 \* 1000/);
assert.match(handsFree, /NETWORK_RETRY_DELAYS_MS/);
assert.doesNotMatch(handsFree, /serviceWorker\.register/);
assert.doesNotMatch(handsFree, /caches\.open/);

const currentRevision = Number(swPolicy.CURRENT_CACHE.match(/v(\d+)$/)?.[1]);
assert.ok(Number.isSafeInteger(currentRevision) && currentRevision > 0);
assert.equal(swPolicy.shouldDeleteCache(`${swPolicy.CACHE_PREFIX}v${currentRevision - 1}`), true);
assert.equal(swPolicy.shouldDeleteCache(swPolicy.CURRENT_CACHE), false);
assert.equal(swPolicy.shouldDeleteCache(`other-cache-v${currentRevision}`), false);

console.log('hands-free PWA wiring checks passed');
