import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/chat-markdown.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

assert.match(index, /href="\/chat-markdown\.css"/);
assert.match(index, /src="\/chat-markdown\.js"/);
assert.match(js, /\.message\.assistant \.content/);
assert.match(js, /MutationObserver/);
assert.match(js, /createElement/);
assert.match(js, /textContent/);
assert.match(js, /replaceChildren/);
assert.match(js, /noopener noreferrer nofollow/);
assert.match(js, /maxInput/);
assert.match(js, /maxTableRows/);
assert.match(css, /message\.assistant \.content/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
assert.doesNotMatch(js, /innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write\s*\(/i);
console.log('test-chat-markdown-source: ok');
