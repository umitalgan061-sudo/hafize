import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const retrySource = await readFile(new URL('../public/response-retry.js', import.meta.url), 'utf8');
const editSource = await readFile(new URL('../public/message-edit.js', import.meta.url), 'utf8');

for (const forbidden of [
  'requestSubmit', 'send.click', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon',
  'localStorage', 'sessionStorage', 'document.cookie', 'Authorization', 'ownerId', 'traceId',
  'child_process', 'exec(', 'spawn(', 'innerHTML'
]) {
  assert.equal(retrySource.includes(forbidden), false, `response retry must not contain ${forbidden}`);
}

assert.match(retrySource, /pair\.user\?\.querySelector\?\.\('\.message-edit-btn'\)/);
assert.match(retrySource, /editButton\.click\(\)/, 'retry must delegate to the guarded edit branch action');
assert.match(retrySource, /hasDraft\(input\.value\)/, 'existing draft must block retry branching');
assert.match(retrySource, /isStreaming\(send\)/, 'streaming must block retry branching');
assert.match(editSource, /source\.messages\.slice\(0, messageIndex\)/, 'edit branch must truncate before retried user turn');
assert.equal(editSource.includes('requestSubmit'), false, 'edit branch must leave final send to the user');

const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));
assert.equal(registry.agents.length, 4);
for (const agent of registry.agents) assert.equal(agent.toolPolicy?.denyByDefault, true);

console.log('response retry branch security tests passed');
