import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/code-wrap-toggle.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(source, /aria-pressed/);
assert.match(source, /Kod satır kaydırmasını aç veya kapat/);
assert.match(source, /shell\.dataset\.wrap = enabled \? 'on' : 'off'/);
assert.match(source, /white-space:pre-wrap/);
assert.match(source, /overflow-wrap:anywhere/);
assert.match(source, /\.message\.assistant \.content\.hafize-markdown \.hafize-code-shell/);
assert.match(source, /:scope > pre/);
assert.match(source, /:scope > code/);
assert.match(source, /MutationObserver/);
assert.match(source, /observer\.observe\(messages, \{ childList: true, subtree: true \}\)/);

for (const forbidden of [
  'fetch(', 'WebSocket', 'XMLHttpRequest', 'sendBeacon',
  'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie',
  'navigator.clipboard', 'requestSubmit', '.click()', 'innerHTML',
  'eval(', 'new Function', 'window.open'
]) assert.ok(!source.includes(forbidden), `wrap toggle must not contain ${forbidden}`);

const copyIndex = loader.indexOf('HafizeCodeBlockCopy');
const wrapIndex = loader.indexOf('HafizeCodeWrapToggle');
assert.ok(copyIndex >= 0);
assert.ok(wrapIndex > copyIndex, 'wrap toggle must load after code block shell exists');
assert.match(loader, /\/code-wrap-toggle\.js/);
assert.match(sw, /hafize-shell-v36/);
assert.match(sw, /'\/code-wrap-toggle\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('code wrap toggle contract ok');