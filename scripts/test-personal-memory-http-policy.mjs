import assert from 'node:assert/strict';
import {
  parseMemoryId,
  parseMemoryReadQuery,
  sanitizeMemoryOperationResult,
  validateMemoryMutationBody
} from '../lib/personal-memory-http-policy.mjs';

function query(search) {
  return parseMemoryReadQuery(new URL(`http://localhost/api/memory${search}`));
}

assert.deepEqual(query('?query=tenis').value, { query: 'tenis' });
assert.deepEqual(query('?query=tenis&kinds=preference,note&limit=20').value, {
  query: 'tenis',
  kinds: ['preference', 'note'],
  limit: 20
});
assert.equal(query('').error, 'INVALID_MEMORY_QUERY');
assert.equal(query('?query=%20%20').error, 'INVALID_MEMORY_QUERY');
assert.equal(query(`?query=${'x'.repeat(1001)}`).error, 'INVALID_MEMORY_QUERY');
assert.equal(query('?query=x&ownerId=attacker').error, 'INVALID_MEMORY_QUERY_FIELD');
assert.equal(query('?query=x&query=y').error, 'INVALID_MEMORY_QUERY_DUPLICATE');
assert.equal(query('?query=x&limit=0').error, 'INVALID_MEMORY_QUERY_LIMIT');
assert.equal(query('?query=x&limit=21').error, 'INVALID_MEMORY_QUERY_LIMIT');
assert.equal(query('?query=x&limit=1.5').error, 'INVALID_MEMORY_QUERY_LIMIT');
assert.equal(query('?query=x&limit=1e1').error, 'INVALID_MEMORY_QUERY_LIMIT');
assert.equal(query('?query=x&limit=NaN').error, 'INVALID_MEMORY_QUERY_LIMIT');
assert.equal(query('?query=x&kinds=preference,preference').error, 'INVALID_MEMORY_QUERY_KINDS');
assert.equal(query('?query=x&kinds=preference,unknown').error, 'INVALID_MEMORY_QUERY_KINDS');
assert.equal(query('?query=x&kinds=preference,note,identity,project,extra').error, 'INVALID_MEMORY_QUERY_KINDS');

assert.equal(parseMemoryReadQuery(null).error, 'INVALID_MEMORY_QUERY');
assert.equal(parseMemoryId('/api/memory/memory_12345678'), 'memory_12345678');
assert.equal(parseMemoryId('/api/memory/not-memory'), null);
assert.equal(parseMemoryId('/api/memory/memory_short'), null);
assert.equal(parseMemoryId('/api/memory/memory_12345678/extra'), null);

let validation = validateMemoryMutationBody('write', {
  kind: 'preference',
  content: 'Tenisi severim',
  sourceType: 'user_statement',
  sensitivity: 'personal',
  explicitUserIntent: true
});
assert.equal(validation.ok, true);
validation = validateMemoryMutationBody('write', {
  kind: 'preference',
  content: 'Tenisi severim',
  sourceType: 'user_statement',
  sensitivity: 'personal'
});
assert.equal(validation.error, 'MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT');
validation = validateMemoryMutationBody('write', {
  kind: 'preference',
  content: 'x',
  sourceType: 'user_statement',
  sensitivity: 'personal',
  explicitUserIntent: true,
  ownerId: 'attacker'
});
assert.equal(validation.error, 'MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT');

assert.equal(validateMemoryMutationBody('export', { explicitUserIntent: true }).ok, true);
assert.equal(
  validateMemoryMutationBody('export', { explicitUserIntent: true, token: 'secret' }).error,
  'MEMORY_EXPORT_REQUIRES_EXPLICIT_USER_INTENT'
);
assert.equal(
  validateMemoryMutationBody('delete-all', { explicitUserIntent: true, confirmDeleteAll: true }).ok,
  true
);
assert.equal(
  validateMemoryMutationBody('delete-all', { explicitUserIntent: true }).error,
  'MEMORY_DELETE_ALL_REQUIRES_CONFIRMATION'
);
assert.equal(
  validateMemoryMutationBody('delete-one', { explicitUserIntent: true, exactMatch: true }).ok,
  true
);
assert.equal(
  validateMemoryMutationBody('delete-one', { explicitUserIntent: true, exactMatch: false }).error,
  'MEMORY_DELETE_REQUIRES_EXPLICIT_USER_INTENT'
);
assert.equal(validateMemoryMutationBody('unknown', {}).error, 'INVALID_MEMORY_MUTATION');

const failed = sanitizeMemoryOperationResult({
  ok: false,
  error: 'SECRET_PATH:/srv/hafize/private.json'
});
assert.deepEqual(failed.body, { error: 'MEMORY_OPERATION_FAILED' });
assert.equal(JSON.stringify(failed).includes('/srv/hafize/private.json'), false);

const succeeded = sanitizeMemoryOperationResult({
  ok: true,
  records: [{ id: 'memory_12345678' }],
  deleted: 1
});
assert.equal(succeeded.status, 200);
assert.deepEqual(succeeded.body.records, [{ id: 'memory_12345678' }]);
assert.equal(succeeded.body.deleted, 1);

console.log('personal memory HTTP policy tests passed');
