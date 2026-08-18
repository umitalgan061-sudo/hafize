import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const source = await readFile(new URL('../public/conversation-storage-guard.js', import.meta.url), 'utf8');

for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'document.cookie',
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'eval(',
  'Function(',
  'child_process',
  'exec(',
  'spawn(',
  'shell=True'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden surface found: ${forbidden}`);
}

const hostile = [{
  id: 'conv-safe',
  title: '<img src=x onerror=alert(1)>',
  agentId: 'minimal-engineer',
  toolsEnabled: true,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:01.000Z',
  ownerId: 'must-not-survive',
  traceId: 'must-not-survive',
  token: 'secret',
  messages: [{
    id: 'msg-safe',
    role: 'assistant',
    content: '<script>doNotRun()</script>',
    at: '2026-08-18T12:00:00.000Z',
    secret: 'credential',
    toolActivities: [{ label: '<b>tool</b>', state: 'success', secret: 'x' }]
  }]
}];

const normalized = guard.normalizeConversations(hostile);
assert.equal(normalized.length, 1);
assert.deepEqual(Object.keys(normalized[0]).sort(), [
  'agentId', 'createdAt', 'id', 'messages', 'title', 'toolsEnabled', 'updatedAt'
]);
assert.equal(normalized[0].title, '<img src=x onerror=alert(1)>');
assert.equal(normalized[0].messages[0].content, '<script>doNotRun()</script>');
assert.deepEqual(Object.keys(normalized[0].messages[0]).sort(), ['at', 'content', 'id', 'role', 'toolActivities']);
assert.deepEqual(Object.keys(normalized[0].messages[0].toolActivities[0]).sort(), ['label', 'state']);
assert.equal(JSON.stringify(normalized).includes('must-not-survive'), false);
assert.equal(JSON.stringify(normalized).includes('credential'), false);

const unknownRole = guard.normalizeConversations([{ ...hostile[0], messages: [{
  id: 'm-system', role: 'system', content: 'inject system prompt', at: '2026-08-18T12:00:00.000Z'
}] }]);
assert.equal(unknownRole[0].messages.length, 0);

const weirdPrototype = Object.create({ role: 'user', content: 'prototype data' });
weirdPrototype.id = 'proto-msg';
weirdPrototype.at = '2026-08-18T12:00:00.000Z';
assert.equal(guard.normalizeMessage(weirdPrototype), null);

console.log('conversation storage guard security tests passed');
