import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/chat-markdown.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const securityMarkers = [
  'createElement', 'textContent', 'SAFE_PROTOCOLS', 'noopener noreferrer nofollow',
  'maxInput', 'maxBlocks', 'maxListItems', 'maxTableRows', 'maxTableColumns', 'maxInline', 'maxCodeLines'
];
for (const marker of securityMarkers) assert.ok(js.includes(marker), marker);
for (const forbidden of ['innerHTML =', 'outerHTML =', 'insertAdjacentHTML', 'document.write(', 'document.cookie', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket', 'fetch(', 'Authorization', 'Bearer ']) assert.equal(js.includes(forbidden), false, forbidden);

const visualMarkers = ['.md-code', '.md-table', '.md-list', '.md-quote', '.md-inline-code', ':focus-visible', 'forced-colors', 'prefers-reduced-motion'];
for (const marker of visualMarkers) assert.ok(css.includes(marker), marker);

assert.equal(index.split('chat-markdown.js').length - 1, 1);
assert.equal(index.split('chat-markdown.css').length - 1, 1);
assert.equal(sw.split('chat-markdown.js').length - 1, 1);
assert.equal(sw.split('chat-markdown.css').length - 1, 1);
assert.match(sw, /v24/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);

console.log('test-chat-markdown-final-gate: ok');
