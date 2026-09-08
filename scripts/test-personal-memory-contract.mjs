import assert from 'node:assert/strict';
import { PERSONAL_MEMORY_CONTRACT, normalizeMemoryDelete, normalizeMemoryRead, normalizeMemoryWrite } from '../lib/personal-memory-contract.mjs';

assert.deepEqual(PERSONAL_MEMORY_CONTRACT.kinds, ['identity', 'preference', 'project', 'note']);
assert.deepEqual(PERSONAL_MEMORY_CONTRACT.sourceTypes, ['user_statement', 'user_note', 'user_import']);
assert.equal(PERSONAL_MEMORY_CONTRACT.allowedSensitivity, 'personal');
assert.equal(PERSONAL_MEMORY_CONTRACT.maxContentLength, 4000);
assert.equal(PERSONAL_MEMORY_CONTRACT.maxQueryLength, 1000);
assert.equal(PERSONAL_MEMORY_CONTRACT.maxReadLimit, 20);
assert.equal(PERSONAL_MEMORY_CONTRACT.plaintextCredentialsAllowed, false);

const validWrite = {
  ownerId: 'user-123', kind: 'preference', content: 'Kısa yanıtları tercih ediyor.', sourceType: 'user_statement',
  sourceRef: 'conversation-42:message-7', sensitivity: 'personal', explicitUserIntent: true
};
assert.deepEqual(normalizeMemoryWrite(validWrite), { ok: true, command: { ownerId: 'user-123', kind: 'preference', content: 'Kısa yanıtları tercih ediyor.', sourceType: 'user_statement', sourceRef: 'conversation-42:message-7', sensitivity: 'personal' } });

assert.deepEqual(normalizeMemoryWrite({ ownerId: 'user-123', kind: 'note', content: 'Not.', sourceType: 'user_note', sensitivity: 'personal' }), { ok: false, error: 'MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT' });
assert.deepEqual(normalizeMemoryWrite({ ownerId: 'user-123', kind: 'note', content: 'Not.', sourceType: 'user_note', sensitivity: 'restricted', explicitUserIntent: true }), { ok: false, error: 'MEMORY_SENSITIVITY_NOT_ALLOWED' });

for (const kind of ['identity', 'preference', 'project', 'note']) assert.equal(normalizeMemoryWrite({ ownerId: 'owner', kind, content: `kind:${kind}`, sourceType: 'user_import', sensitivity: 'personal', explicitUserIntent: true }).ok, true);
for (const invalidKind of ['', 'credential', 'other']) assert.deepEqual(normalizeMemoryWrite({ ownerId: 'owner', kind: invalidKind, content: 'x', sourceType: 'user_note', sensitivity: 'personal', explicitUserIntent: true }), { ok: false, error: 'INVALID_MEMORY_COMMAND:kind' });
assert.deepEqual(normalizeMemoryWrite({ ownerId: 'owner', kind: 'note', content: 'x', sourceType: 'assistant_guess', sensitivity: 'personal', explicitUserIntent: true }), { ok: false, error: 'INVALID_MEMORY_COMMAND:sourceType' });
assert.deepEqual(normalizeMemoryWrite({ ...validWrite, extra: 'not accepted' }), { ok: false, error: 'INVALID_MEMORY_COMMAND:field' });

const credentialExamples = [
  'password: hunter22',
  'Authorization: Bearer abcdefghijklmnop',
  'github_pat_1234567890abcdefghijABCDEFGHIJ',
  'ghp_1234567890abcdefghijklmnopqrstuvwx',
  'nvapi-1234567890abcdefghijklmnopqrstuv',
  'ya29.A0ARrdaM_exampleGoogleOauthToken123456789',
  '-----BEGIN PRIVATE KEY-----\nplaintext-private-material'
];
for (const content of credentialExamples) {
  assert.equal(normalizeMemoryWrite({ ...validWrite, content }).error, 'MEMORY_CONTENT_CREDENTIAL_NOT_ALLOWED');
}
for (const sourceRef of ['import:access_token=abcdef123456', 'Authorization: Bearer abcdefghijklmnop', 'github_pat_1234567890abcdefghijABCDEFGHIJ', 'ya29.A0ARrdaM_exampleGoogleOauthToken123456789']) {
  assert.equal(normalizeMemoryWrite({ ...validWrite, sourceRef }).error, 'MEMORY_SOURCE_REF_CREDENTIAL_NOT_ALLOWED');
}

assert.deepEqual(normalizeMemoryRead({ ownerId: ' user-123 ', query: ' projelerim ', kinds: ['project', 'note'], limit: 8 }), { ok: true, command: { ownerId: 'user-123', query: 'projelerim', kinds: ['project', 'note'], limit: 8 } });
assert.deepEqual(normalizeMemoryRead({ ownerId: 'owner', query: 'tercihler' }), { ok: true, command: { ownerId: 'owner', query: 'tercihler', kinds: [], limit: 5 } });
for (const query of [...credentialExamples.slice(0, 6), 'api_key=abcdef123456']) assert.equal(normalizeMemoryRead({ ownerId: 'owner', query }).error, 'MEMORY_QUERY_CREDENTIAL_NOT_ALLOWED');
assert.equal(normalizeMemoryRead({ ownerId: 'owner', query: 'GitHub PAT güvenliği hakkında notlar.' }).ok, true);

assert.deepEqual(normalizeMemoryRead({ ownerId: 'owner', query: 'x', kinds: ['note', 'note'] }), { ok: false, error: 'INVALID_MEMORY_COMMAND:kinds.duplicate' });
assert.deepEqual(normalizeMemoryRead({ ownerId: 'owner', query: 'x', limit: 0 }), { ok: false, error: 'INVALID_MEMORY_COMMAND:limit' });
assert.deepEqual(normalizeMemoryRead({ ownerId: 'owner', query: 'x', limit: 21 }), { ok: false, error: 'INVALID_MEMORY_COMMAND:limit' });
assert.deepEqual(normalizeMemoryDelete({ ownerId: 'user-123', memoryId: 'memory_abcdefgh1234', exactMatch: true }), { ok: true, command: { ownerId: 'user-123', memoryId: 'memory_abcdefgh1234' } });
assert.deepEqual(normalizeMemoryDelete({ ownerId: 'user-123', memoryId: 'memory_abcdefgh1234', exactMatch: false }), { ok: false, error: 'MEMORY_DELETE_REQUIRES_EXACT_MATCH' });
assert.deepEqual(normalizeMemoryDelete({ ownerId: 'user-123', memoryId: 'all', exactMatch: true }), { ok: false, error: 'INVALID_MEMORY_COMMAND:memoryId' });
assert.deepEqual(normalizeMemoryDelete({ ownerId: 'user-123', memoryId: 'memory_abcdefgh1234', exactMatch: true, broad: true }), { ok: false, error: 'INVALID_MEMORY_COMMAND:field' });
for (const normalizer of [normalizeMemoryWrite, normalizeMemoryRead, normalizeMemoryDelete]) assert.deepEqual(normalizer(null), { ok: false, error: 'INVALID_MEMORY_COMMAND:input' });
console.log('personal memory credential-boundary tests passed');
