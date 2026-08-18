import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/message-edit.js', import.meta.url), 'utf8');

for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  'document.cookie', 'navigator.clipboard', 'Authorization', 'ownerId', 'traceId',
  'child_process', 'exec(', 'spawn(', 'shell=True', 'innerHTML'
]) {
  assert.equal(source.includes(forbidden), false, `message edit branch must not contain ${forbidden}`);
}

assert.match(source, /const DRAFT_HANDOFF_KEY = 'hafize\.edit-branch-draft\.v1'/);
assert.match(source, /const MAX_HANDOFF_AGE_MS = 90_000/);
assert.match(source, /handoffStorage\.removeItem\(DRAFT_HANDOFF_KEY\)/, 'handoff must be cleared after restore/failure');
assert.match(source, /source\.messages\.slice\(0, messageIndex\)/, 'selected user turn and later history must not be copied');
assert.match(source, /activeConversationId\(canonical\.value\) !== found\.conversation\.id/, 'edit target must belong to the active conversation');
assert.match(source, /sendButton\?\.classList\?\.contains\('streaming'\)/, 'streaming must block branching');
assert.match(source, /input\.value\.trim\(\)/, 'existing composer draft must be preserved');
assert.equal(source.includes('requestSubmit'), false, 'branching must never auto-submit a message');
assert.equal(source.includes("sendButton.click"), false, 'branching must never click send');

const guardSource = await readFile(new URL('../public/conversation-storage-guard.js', import.meta.url), 'utf8');
assert.match(guardSource, /ALLOWED_ROLES = new Set\(\['user', 'assistant'\]\)/);
assert.match(guardSource, /MAX_MESSAGES_PER_CONVERSATION = 200/);
assert.match(guardSource, /MAX_MESSAGE_CHARS = 12_000/);
assert.match(guardSource, /MAX_TOTAL_CONTENT_CHARS = 1_200_000/);

const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));
assert.equal(registry.agents.length, 4, 'selective four-agent roster must remain intact');
assert.equal(registry.agents.filter((agent) => agent.role === 'selector').length, 2);
assert.equal(registry.agents.filter((agent) => agent.role === 'specialist').length, 2);
for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy?.denyByDefault, true, `${agent.id} must remain backend default-deny`);
}

console.log('message edit branch security tests passed');
