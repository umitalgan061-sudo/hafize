import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const now = '2026-08-18T12:00:00.000Z';

function baseMessage(overrides = {}) {
  return { id: 'm1', role: 'user', content: 'Merhaba', at: now, ...overrides };
}
function baseConversation(overrides = {}) {
  return {
    id: 'c1', title: 'Başlık', agentId: 'minimal-engineer', toolsEnabled: false,
    createdAt: now, updatedAt: now, messages: [baseMessage()], ...overrides
  };
}

const malformedTopLevels = [null, {}, '[]', 42, true, { length: 1 }];
for (const value of malformedTopLevels) assert.deepEqual(guard.normalizeConversations(value), []);

const invalidConversations = [
  baseConversation({ id: '../escape' }),
  baseConversation({ id: '' }),
  baseConversation({ createdAt: 'x' }),
  baseConversation({ updatedAt: 'x' }),
  baseConversation({ messages: null })
];
assert.equal(guard.normalizeConversations(invalidConversations).length, 0);

const invalidMessages = [
  baseMessage({ id: '../x' }),
  baseMessage({ role: 'tool' }),
  baseMessage({ role: 'system' }),
  baseMessage({ at: 'yesterday' }),
  baseMessage({ content: 5 }),
  { id: 'missing-role', content: 'x', at: now }
];
const filtered = guard.normalizeConversation(baseConversation({ messages: invalidMessages }));
assert.equal(filtered.messages.length, 0);

const nulText = guard.normalizeMessage(baseMessage({ content: 'a\u0000b\u0000c' }));
assert.equal(nulText.content, 'abc');
const nfd = 'c\u0327';
const nfc = guard.normalizeMessage(baseMessage({ content: nfd }));
assert.equal(nfc.content, nfd.normalize('NFC'));

const title = guard.normalizeConversation(baseConversation({ title: 't'.repeat(guard.MAX_TITLE_CHARS + 20) }));
assert.equal(title.title.length, guard.MAX_TITLE_CHARS);
const fallbackTitle = guard.normalizeConversation(baseConversation({ title: '   ' }));
assert.equal(fallbackTitle.title, 'Yeni sohbet');

const bogusActivities = guard.normalizeMessage(baseMessage({
  role: 'assistant',
  content: 'Yanıt',
  toolActivities: [
    null,
    { label: '', state: 'success' },
    { label: 'x', state: 'unknown' },
    { label: 'ok', state: 'success', extra: 'drop' },
    { label: 'bool', ok: false }
  ]
}));
assert.deepEqual(bogusActivities.toolActivities, [
  { label: 'ok', state: 'success' },
  { label: 'bool', state: 'failure' }
]);

const unordered = [
  baseConversation({ id: 'old', updatedAt: '2026-08-18T10:00:00.000Z', messages: [baseMessage({ id: 'a' })] }),
  baseConversation({ id: 'new', updatedAt: '2026-08-18T14:00:00.000Z', messages: [baseMessage({ id: 'b' })] })
];
assert.deepEqual(guard.normalizeConversations(unordered).map((item) => item.id), ['new', 'old']);

const canonical = JSON.stringify(guard.normalizeConversations([baseConversation()]));
const clean = guard.sanitizeStoredValue(canonical);
assert.equal(clean.changed, false);
assert.equal(clean.serialized, canonical);
const padded = guard.sanitizeStoredValue(` ${canonical} `);
assert.equal(padded.changed, true);
assert.equal(padded.serialized, canonical);

const withUnknownFields = JSON.stringify([{ ...baseConversation(), debug: 'drop', messages: [{ ...baseMessage(), debug: 'drop' }] }]);
const stripped = guard.sanitizeStoredValue(withUnknownFields);
assert.equal(stripped.changed, true);
assert.equal(stripped.serialized.includes('debug'), false);

const duplicate = JSON.stringify([
  baseConversation({ id: 'same', messages: [baseMessage({ id: 'same-message' })] }),
  baseConversation({ id: 'same', title: 'ikinci', messages: [baseMessage({ id: 'second-message' })] })
]);
const deduped = guard.sanitizeStoredValue(duplicate);
assert.equal(deduped.value.length, 1);
assert.equal(deduped.value[0].title, 'Başlık');

console.log('conversation storage guard adversarial tests passed');
