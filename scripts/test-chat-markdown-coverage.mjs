import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const docs = readFileSync(new URL('../docs/CHAT_MARKDOWN.md', import.meta.url), 'utf8');
for (const marker of ['heading', 'list', 'quote', 'code', 'table', 'link', 'Clipboard', 'MutationObserver']) assert.match(`${js}\n${docs}`, new RegExp(marker, 'i'), marker);
assert.match(js, /SAFE_PROTOCOLS/);
assert.match(js, /maxInput/);
assert.match(js, /maxBlocks/);
assert.match(js, /maxTableRows/);
assert.match(js, /maxCodeLines/);
console.log('test-chat-markdown-coverage: ok');
