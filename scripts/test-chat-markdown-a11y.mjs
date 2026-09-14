import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/chat-markdown.css', import.meta.url), 'utf8');

assert.match(js, /aria-label/);
assert.match(js, /target = '_blank'/);
assert.match(js, /rel = 'noopener noreferrer nofollow'/);
assert.match(js, /md-code-copy/);
assert.match(js, /aria-label.*Kod bloğunu kopyala/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
assert.match(css, /overflow:auto/);
assert.match(css, /overflow-wrap:anywhere/);
assert.match(css, /max-width:100%/);
assert.match(css, /tab-size:2/);

const focusables = (css.match(/:focus-visible/g) || []).length;
assert.ok(focusables >= 2);

console.log('test-chat-markdown-a11y: ok');
