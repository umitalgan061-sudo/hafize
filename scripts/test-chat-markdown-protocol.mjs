import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer = fs.readFileSync('public/markdown-renderer.js', 'utf8');
const chat = fs.readFileSync('public/chat-markdown.js', 'utf8');
const css = fs.readFileSync('public/chat-markdown.css', 'utf8');
assert.match(renderer, /renderMarkdown|parseMarkdown/);
assert.match(renderer, /LIMITS/);
assert.match(chat, /requestAnimationFrame/);
assert.match(chat, /aria-busy/);
assert.match(chat, /navigator\.clipboard/);
assert.match(css, /message\.assistant/);
assert.doesNotMatch(css, /body\s*\{/);
console.log('chat markdown protocol contract: ok');
