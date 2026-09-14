import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../docs/', import.meta.url);
const names = readdirSync(root, { withFileTypes: true }).filter((item) => item.isFile()).map((item) => item.name);
const required = [
  'CHAT_MARKDOWN.md',
  'CHAT_MARKDOWN_SECURITY.md',
  'CHAT_MARKDOWN_RUNBOOK.md',
  'CHAT_MARKDOWN_TEST_MATRIX.md',
  'CHAT_MARKDOWN_STREAMING.md',
  'CHAT_MARKDOWN_PERFORMANCE.md',
  'CHAT_MARKDOWN_ACCESSIBILITY.md',
  'CHAT_MARKDOWN_ROLLBACK.md'
];
for (const name of required) assert.equal(names.includes(name), true, name);

const docs = required.map((name) => readFileSync(new URL(name, root), 'utf8')).join('\n');
for (const marker of ['security', 'streaming', 'PWA', 'mobil', 'rollback', 'Clipboard', 'limit']) assert.match(docs, new RegExp(marker, 'i'), marker);
assert.match(docs, /http/);
assert.match(docs, /javascript/);
assert.match(docs, /localStorage/);
assert.match(docs, /MutationObserver/);

console.log('test-chat-markdown-documentation: ok');
