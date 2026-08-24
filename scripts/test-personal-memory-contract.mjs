import assert from 'node:assert/strict';
import {
  PERSONAL_MEMORY_CONTRACT,
  normalizeMemoryDelete,
  normalizeMemoryRead,
  normalizeMemoryWrite
} from '../lib/personal-memory-contract.mjs';

assert.deepEqual(PERSONAL_MEMORY_CONTRACT.kinds, ['identity', 'preference', 'project', 'note']);
assert.deepEqual(PERSONAL_MEMORY_CONTRACT.sourceTypes, ['user_statement', 'user_note', 'user_import']);
assert.equal(PERSONAL_MEMORY_CONTRACT.allowedSensitivity, 'personal');
assert.equal(PERSONAL_MEMORY_CONTRACT.maxContentLength, 4000);
assert.equal(PERSONAL_MEMORY_CONTRACT.maxQueryLength, 1000);
assert.equal(PERSONAL_MEMORY_CONTRACT.maxReadLimit, 20);
assert.ok(Object.isFrozen(PERSONAL_MEMORY_CONTRACT));
assert.ok(Object.isFrozen(PERSONAL_MEMORY_CONTRACT.kinds));
assert.ok(Object.isFrozen(PERSONAL_MEMORY_CONTRACT.sourceTypes));

const write = normalizeMemoryWrite({
  ownerId: 'user-123',
  kind: 'preference',
  content: 'Kısa yanıtları tercih ediyor.',
  sourceType: 'user_statement',
  sourceRef: 'conversation-42:message-7',
  sensitivity: 'personal',
  explicitUserIntent: true
});
assert.deepEqual(write, {
  ok: true,
  command: {
    ownerId: 'user-123',
    kind: 'preference',
    content: 'Kısa yanıtları tercih ediyor.',
    sourceType: 'user_statement',
    sourceRef: 'conversation-42:message-7',
    sensitivity: 'personal'
  }
});
assert.equal('explicitUserIntent' in write.command, false);

assert.deepEqual(
  normalizeMemoryWrite({
    ownerId: 'user-123',
    kind: 'note',
    content: 'Not.',
    sourceType: 'user_note',
    sensitivity: 'personal'
  }),
  { ok: false, error: 'MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT' }
);

assert.deepEqual(
  normalizeMemoryWrite({
    ownerId: 'user-123',
    kind: 'note',
    content: 'Not.',
    sourceType: 'user_note',
    sensitivity: 'restricted',
    explicitUserIntent: true
  }),
  { ok: false, error: 'MEMORY_SENSITIVITY_NOT_ALLOWED' }
);

const memoryWrite = (content) => normalizeMemoryWrite({
  ownerId: 'owner',
  kind: 'note',
  content,
  sourceType: 'user_note',
  sensitivity: 'personal',
  explicitUserIntent: true
});

for (const content of [
  'api_key=abcdef123456',
  'password: hunter22',
  'client secret: verysecretvalue',
  'Authorization: Bearer abcdefghijklmnop',
  'Proxy-Authorization: Basic dXNlcjpwYXNzd29yZA==',
  '-----BEGIN PRIVATE KEY-----\nplaintext-private-material'
]) {
  assert.deepEqual(
    memoryWrite(content),
    { ok: false, error: 'MEMORY_PLAINTEXT_CREDENTIAL_NOT_ALLOWED' },
    `plaintext credential must be rejected: ${content.split('\n', 1)[0]}`
  );
}

for (const content of [
  'API keyleri yalnız sunucu tarafında sakla.',
  'Parolamı hafızaya kaydetme.',
  'Authorization header kullanımı hakkında not.',
  'secret yönetimi için ayrı bir tasarım gerekiyor.'
]) {
  assert.equal(memoryWrite(content).ok, true, `non-secret discussion must remain storable: ${content}`);
}

for (const kind of ['identity', 'preference', 'project', 'note']) {
  assert.equal(normalizeMemoryWrite({
    ownerId: 'owner',
    kind,
    content: `kind:${kind}`,
    sourceType: 'user_import',
    sensitivity: 'personal',
    explicitUserIntent: true
  }).ok, true);
}

for (const invalidKind of ['', 'credential', 'other']) {
  assert.deepEqual(
    normalizeMemoryWrite({
      ownerId: 'owner',
      kind: invalidKind,
      content: 'x',
      sourceType: 'user_note',
      sensitivity: 'personal',
      explicitUserIntent: true
    }),
    { ok: false, error: 'INVALID_MEMORY_COMMAND:kind' }
  );
}

assert.deepEqual(
  normalizeMemoryWrite({
    ownerId: 'owner',
    kind: 'note',
    content: 'x',
    sourceType: 'assistant_guess',
    sensitivity: 'personal',
    explicitUserIntent: true
  }),
  { ok: false, error: 'INVALID_MEMORY_COMMAND:sourceType' }
);

assert.deepEqual(
  normalizeMemoryWrite({
    ownerId: 'owner',
    kind: 'note',
    content: 'x',
    sourceType: 'user_note',
    sensitivity: 'personal',
    explicitUserIntent: true,
    extra: 'not accepted'
  }),
  { ok: false, error: 'INVALID_MEMORY_COMMAND:field' }
);

assert.deepEqual(
  normalizeMemoryRead({
    ownerId: ' user-123 ',
    query: ' projelerim ',
    kinds: ['project', 'note'],
    limit: 8
  }),
  {
    ok: true,
    command: {
      ownerId: 'user-123',
      query: 'projelerim',
      kinds: ['project', 'note'],
      limit: 8
    }
  }
);

assert.deepEqual(
  normalizeMemoryRead({ ownerId: 'owner', query: 'tercihler' }),
  { ok: true, command: { ownerId: 'owner', query: 'tercihler', kinds: [], limit: 5 } }
);

assert.deepEqual(
  normalizeMemoryRead({ ownerId: 'owner', query: 'x', kinds: ['note', 'note'] }),
  { ok: false, error: 'INVALID_MEMORY_COMMAND:kinds.duplicate' }
);
assert.deepEqual(
  normalizeMemoryRead({ ownerId: 'owner', query: 'x', limit: 0 }),
  { ok: false, error: 'INVALID_MEMORY_COMMAND:limit' }
);
assert.deepEqual(
  normalizeMemoryRead({ ownerId: 'owner', query: 'x', limit: 21 }),
  { ok: false, error: 'INVALID_MEMORY_COMMAND:limit' }
);

assert.deepEqual(
  normalizeMemoryDelete({
    ownerId: 'user-123',
    memoryId: 'memory_abcdefgh1234',
    exactMatch: true
  }),
  { ok: true, command: { ownerId: 'user-123', memoryId: 'memory_abcdefgh1234' } }
);
assert.deepEqual(
  normalizeMemoryDelete({
    ownerId: 'user-123',
    memoryId: 'memory_abcdefgh1234',
    exactMatch: false
  }),
  { ok: false, error: 'MEMORY_DELETE_REQUIRES_EXACT_MATCH' }
);
assert.deepEqual(
  normalizeMemoryDelete({ ownerId: 'user-123', memoryId: 'all', exactMatch: true }),
  { ok: false, error: 'INVALID_MEMORY_COMMAND:memoryId' }
);
assert.deepEqual(
  normalizeMemoryDelete({ ownerId: 'user-123', memoryId: 'memory_abcdefgh1234', exactMatch: true, broad: true }),
  { ok: false, error: 'INVALID_MEMORY_COMMAND:field' }
);

for (const normalizer of [normalizeMemoryWrite, normalizeMemoryRead, normalizeMemoryDelete]) {
  assert.deepEqual(normalizer(null), { ok: false, error: 'INVALID_MEMORY_COMMAND:input' });
}

console.log('personal memory contract tests passed');