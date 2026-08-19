import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/in-chat-find.js');

function node(text) {
  const classes = new Set(['message']);
  return {
    classList: { contains: (x) => classes.has(x), add: (x) => classes.add(x), remove: (x) => classes.delete(x) },
    querySelector: (selector) => selector === '.content' ? { textContent: text } : null,
    scrollIntoView(options) { this.scroll = options; }
  };
}

assert.equal(api.normalizeQuery(' Merhaba   DÜNYA '), 'merhaba dünya');
assert.equal(api.normalizeQuery('x'.repeat(121)), null);
const a = node('Merhaba Dünya');
const b = node('başka mesaj');
assert.deepEqual(api.matchingMessages([a, b], 'dünya'), [a]);
assert.deepEqual(api.matchingMessages([a, b], ''), []);
assert.equal(api.matchingMessages([a], 'x'.repeat(121)), null);

const source = fs.readFileSync(path.resolve('public/in-chat-find.js'), 'utf8');
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'document.cookie', 'clipboard', 'requestSubmit(', '.click()']) {
  assert.equal(source.includes(forbidden), false, `forbidden token: ${forbidden}`);
}
assert.match(source, /\.content/);
assert.match(source, /ctrlKey \|\| event\?\.metaKey/);
assert.match(source, /key === 'escape'/);
assert.match(source, /key === 'enter'/);
assert.match(source, /scrollIntoView/);
assert.match(source, /characterData: true/);

const loader = fs.readFileSync(path.resolve('public/chat-run-controller.js'), 'utf8');
assert.match(loader, /HafizeInChatFind/);
assert.match(loader, /\/in-chat-find\.js/);
const sw = fs.readFileSync(path.resolve('public/sw-policy.js'), 'utf8');
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(sw, /'\/in-chat-find\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);
console.log('in-chat find tests passed');