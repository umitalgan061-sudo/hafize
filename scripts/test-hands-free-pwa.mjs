import assert from 'node:assert/strict';
import { assertVersionedCacheDeclaration, shellAssetForBrowserModule } from './shell-cache-contract.mjs';
import { loadBrowserModule } from './browser-module.mjs';
const policy = await loadBrowserModule('public/sw-policy.ts');
const origin = 'https://hafize.example';

assertVersionedCacheDeclaration();
for (const asset of [
  '/screen-share.css',
  shellAssetForBrowserModule('screen-share'),
  '/hands-free.css',
  shellAssetForBrowserModule('hands-free')
]) {
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
