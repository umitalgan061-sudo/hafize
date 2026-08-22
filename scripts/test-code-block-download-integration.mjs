import assert from 'node:assert/strict';
import fs from 'node:fs';

const feature = fs.readFileSync(new URL('../public/code-block-download.js', import.meta.url), 'utf8');
const copy = fs.readFileSync(new URL('../public/code-block-copy.js', import.meta.url), 'utf8');
const focus = fs.readFileSync(new URL('../public/code-block-focus.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(loader, /HafizeCodeBlockDownload/);
assert.match(loader, /\/code-block-download\.js/);
assert.match(loader, /data-hafize-code-block-download/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(sw, /'\/code-block-download\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(copy, /hafize-code-shell/);
assert.match(focus, /hafize-code-focus/);
assert.match(feature, /closest\?\.\('\.hafize-code-shell'\)/);
assert.match(feature, /top:38px/);
assert.match(feature, /padding-top:65px/);
assert.match(feature, /MutationObserverImpl/);
assert.match(feature, /text\/plain;charset=utf-8/);
assert.doesNotMatch(feature, /application\/octet-stream/);

for (const token of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage',
  'document.cookie', 'navigator.clipboard', 'requestSubmit', '.submit(', 'eval(', 'innerHTML'
]) assert.equal(feature.includes(token), false, `forbidden integration token: ${token}`);

console.log('code block download integration ok');
