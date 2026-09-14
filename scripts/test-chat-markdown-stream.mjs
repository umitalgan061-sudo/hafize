import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
assert.match(source, /markdownSource/);
assert.match(source, /markdownWriting/);
assert.match(source, /MutationObserver/);
assert.match(source, /querySelectorAll\('\.message\.assistant \.content'\)/);
assert.match(source, /if \(!source \|\| content\.dataset\.markdownSource === source/);
assert.match(source, /queueMicrotask/);
assert.match(source, /observer\.observe\(messages/);

const required = [
  'subtree: true',
  'childList: true',
  'characterData: true'
];
for (const token of required) assert.ok(source.includes(token), token);

assert.match(source, /closed/);
assert.match(source, /FENCE/);
assert.match(source, /maxCodeLines/);
console.log('test-chat-markdown-stream: ok');
