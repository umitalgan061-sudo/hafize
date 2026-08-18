import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');

function message(index, overrides = {}) {
  return {
    id: `m-${index}`,
    role: index % 2 ? 'assistant' : 'user',
    content: `message-${index}`,
    at: new Date(Date.UTC(2026, 0, 1, 0, 0, index % 60)).toISOString(),
    ...overrides
  };
}

const values = Array.from({ length: 215 }, (_, index) => message(index));
const normalized = guard.normalizeMessages(values);
assert.equal(normalized.length, 200);
assert.equal(normalized[0].id, 'm-15');
assert.equal(normalized.at(-1).id, 'm-214');
assert.deepEqual(normalized.map((item) => item.id), values.slice(15).map((item) => item.id));

const duplicateNewest = [
  message(1),
  message(2),
  message(3, { id: 'same', content: 'older copy' }),
  message(4, { id: 'same', content: 'newer copy' })
];
const deduped = guard.normalizeMessages(duplicateNewest);
assert.equal(deduped.length, 3);
assert.equal(deduped.at(-1).id, 'same');
assert.equal(deduped.at(-1).content, 'newer copy');

const malformedTail = [
  ...Array.from({ length: 205 }, (_, index) => message(index)),
  { id: 'bad', role: 'system', content: 'ignore me', at: new Date().toISOString() },
  { id: 'bad-2', role: 'user', content: '', at: new Date().toISOString() }
];
const withMalformedTail = guard.normalizeMessages(malformedTail);
assert.equal(withMalformedTail.length, 200);
assert.equal(withMalformedTail[0].id, 'm-5');
assert.equal(withMalformedTail.at(-1).id, 'm-204');
assert.equal(withMalformedTail.some((item) => item.role === 'system'), false);

const long = guard.normalizeMessage(message(9, { content: 'x'.repeat(guard.MAX_MESSAGE_CHARS + 20) }));
assert.equal(long.content.length, guard.MAX_MESSAGE_CHARS);

assert.equal(Object.isFrozen(normalized), true);
assert.equal(Object.isFrozen(normalized[0]), true);
console.log('conversation storage retention: ok');
