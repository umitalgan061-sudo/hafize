import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const policy = require('../public/sw-policy.js');
const origin = 'https://hafize.example';

assert.match(policy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
for (const asset of ['/screen-share.css', '/screen-share.js', '/hands-free.css', '/hands-free.js']) {
  assert.ok(policy.SHELL_ASSETS.includes(asset));
  assert.equal(policy.classifyRequest({
    url: new URL(asset, origin).href,
    method: 'GET', mode: 'same-origin', headers: {}
  }, origin), 'shell');
}
assert.equal(policy.classifyRequest({
  url: `${origin}/api/agent/run`, method: 'GET', mode: 'same-origin', headers: {}
}, origin), 'network-only');

console.log('hands-free PWA cache tests passed');
