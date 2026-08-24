import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync(new URL('../public/response-fold.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(loader, /HafizeResponseFold/);
assert.match(loader, /\/response-fold\.js/);
assert.match(loader, /data-hafize-response-fold/);
assert.equal((loader.match(/\/response-fold\.js/g) || []).length, 1);

assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(sw, /'\/response-fold\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.equal((sw.match(/'\/response-fold\.js'/g) || []).length, 1);

assert.match(controller, /\.message\.assistant/);
assert.match(controller, /#sendBtn/);
assert.match(controller, /classList\?\.contains\?\.\('streaming'\)/);
assert.match(controller, /Devamını göster/);
assert.match(controller, /Daralt/);
assert.match(controller, /aria-expanded/);
assert.match(controller, /aria-controls/);
assert.match(controller, /aria-label/);
assert.match(controller, /max-height:min\(46vh,420px\)/);
assert.match(controller, /pointer-events:none/);
assert.match(controller, /@media\(max-width:720px\)/);

const forbidden = [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage',
  'document.cookie', 'navigator.clipboard', 'requestSubmit', '.submit(', '/api/chat', '/api/agent/run',
  'innerHTML', 'outerHTML', 'eval(', 'Function('
];
for (const token of forbidden) assert.equal(controller.includes(token), false, `forbidden token: ${token}`);

assert.match(controller, /observer\.observe\(messages/);
assert.match(controller, /observer\.observe\(sendButton/);
assert.match(controller, /observer\?\.disconnect/);
assert.match(controller, /delete article\.dataset\[MARKER\]/);
assert.match(controller, /content\?\.classList\?\.remove/);

console.log('response fold integration contract ok');
