import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/chat-markdown.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const requiredJs = ['LIMITS', 'SAFE_PROTOCOLS', 'parseMarkdown', 'scanInline', 'renderMarkdown', 'copyCode', 'install', 'MutationObserver'];
for (const token of requiredJs) assert.ok(js.includes(token), token);
const requiredCss = ['.md-code', '.md-table', '.md-list', '.md-quote', '.md-inline-code'];
for (const token of requiredCss) assert.ok(css.includes(token), token);
assert.equal((index.match(/chat-markdown\.js/g) || []).length, 1);
assert.equal((index.match(/chat-markdown\.css/g) || []).length, 1);
assert.equal((sw.match(/chat-markdown\.js/g) || []).length, 1);
assert.equal((sw.match(/chat-markdown\.css/g) || []).length, 1);
assert.match(sw, /v24/);
assert.match(sw, /\/api\//);

const unsafeSinks = ['innerHTML =', 'outerHTML =', 'insertAdjacentHTML', 'document.write('];
for (const sink of unsafeSinks) assert.equal(js.includes(sink), false, sink);
const unsafeNetwork = ['fetch(', 'XMLHttpRequest', 'WebSocket'];
for (const marker of unsafeNetwork) assert.equal(js.includes(marker), false, marker);

assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
assert.match(css, /focus-visible/);
assert.match(css, /overflow:auto/);

console.log('test-chat-markdown-contract: ok');
