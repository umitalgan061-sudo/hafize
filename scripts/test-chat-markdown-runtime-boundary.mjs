// Runtime boundary contract for Markdown modules loaded after the legacy app bundle.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('public/app.js', 'utf8');
const renderer = fs.readFileSync('public/markdown-renderer.js', 'utf8');
const chat = fs.readFileSync('public/chat-markdown.js', 'utf8');

assert.match(app, /updateMessage\(assistantId, content\)/);
assert.match(chat, /HafizeMarkdown/);
assert.match(chat, /MutationObserver/);
assert.match(renderer, /createElement/);
assert.match(renderer, /textContent/);
assert.doesNotMatch(renderer, /innerHTML\s*=/);
assert.doesNotMatch(chat, /innerHTML\s*=/);
assert.doesNotMatch(chat, /fetch\s*\(/);

console.log('chat markdown runtime boundary: ok');
