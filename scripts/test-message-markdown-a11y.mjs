import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer = fs.readFileSync(new URL('../public/message-markdown.js', import.meta.url), 'utf8');
const tools = fs.readFileSync(new URL('../public/message-markdown-tools.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/message-markdown.css', import.meta.url), 'utf8');
const toolsCss = fs.readFileSync(new URL('../public/message-markdown-tools.css', import.meta.url), 'utf8');
assert.ok(renderer.includes("createElement('blockquote')"));
assert.ok(renderer.includes("createElement('ul')"));
assert.ok(renderer.includes("createElement('ol')"));
assert.ok(renderer.includes("createElement('pre')"));
assert.ok(tools.includes("setAttribute('aria-expanded'"));
assert.ok(tools.includes("setAttribute('role', 'status')"));
assert.ok(css.includes(':focus-visible'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(css.includes('forced-colors'));
assert.ok(toolsCss.includes(':focus-visible'));
assert.ok(toolsCss.includes('forced-colors'));
console.log('message markdown accessibility contract ok');
