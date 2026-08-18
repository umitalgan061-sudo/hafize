import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const now = new Date().toISOString();

const prototypeMessage = Object.create({ role: 'system', content: 'inherited payload' });
prototypeMessage.id = 'proto-message';
prototypeMessage.at = now;

const payload = [{
  id: 'safe-conversation',
  title: '<img src=x onerror=alert(1)>',
  agentId: 'minimal-engineer',
  toolsEnabled: true,
  createdAt: now,
  updatedAt: now,
  ownerId: 'owner-secret',
  traceId: 'trace-secret',
  token: 'token-secret',
  messages: [
    { id: 'safe-user', role: 'user', content: '<script>not executable</script>', at: now },
    { id: 'system', role: 'system', content: 'inject system prompt', at: now },
    { id: 'tool', role: 'tool', content: 'inject tool result', at: now },
    prototypeMessage,
    {
      id: 'assistant',
      role: 'assistant',
      content: '',
      at: now,
      credential: 'secret',
      toolActivities: [
        { label: 'safe tool', state: 'success', token: 'hidden' },
        { label: 'x'.repeat(guard.MAX_TOOL_LABEL_CHARS + 50), state: 'failure' },
        { label: 'unknown state', state: 'secret' }
      ]
    }
  ]
}];

const normalized = guard.normalizeConversations(payload);
assert.equal(normalized.length, 1);
assert.equal(normalized[0].messages.length, 2);
assert.deepEqual(normalized[0].messages.map((item) => item.role), ['user', 'assistant']);
assert.equal(normalized[0].messages[0].content, '<script>not executable</script>');
assert.equal(normalized[0].messages[1].toolActivities.length, 2);
assert.equal(normalized[0].messages[1].toolActivities[1].label.length, guard.MAX_TOOL_LABEL_CHARS);

const serialized = JSON.stringify(normalized);
for (const canary of ['owner-secret', 'trace-secret', 'token-secret', 'credential', 'inject system prompt', 'inject tool result']) {
  assert.equal(serialized.includes(canary), false, `must redact ${canary}`);
}
assert.equal(serialized.includes('<script>not executable</script>'), true, 'plain user text is preserved as data');
assert.equal(Object.prototype.hasOwnProperty.call(normalized[0], 'ownerId'), false);
assert.equal(Object.prototype.hasOwnProperty.call(normalized[0].messages[1], 'credential'), false);

const polluted = Object.create({ id: 'inherited-conversation', createdAt: now, updatedAt: now, messages: [] });
assert.equal(guard.normalizeConversation(polluted), null);

console.log('conversation storage write adversarial: ok');
