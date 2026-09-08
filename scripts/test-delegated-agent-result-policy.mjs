import assert from 'node:assert/strict';
import { MAX_DELEGATED_CONTENT_CHARS, MAX_DELEGATED_ERROR_CHARS, normalizeDelegatedAgentResult } from '../lib/delegated-agent-result-policy.mjs';

function expectInvalid(value, reason) {
  const normalized = normalizeDelegatedAgentResult(value);
  assert.equal(normalized.ok, false);
  assert.equal(normalized.error, 'DELEGATED_RESULT_INVALID');
  assert.equal(normalized.reason, reason);
  assert.equal(Object.isFrozen(normalized), true);
}

assert.deepEqual(normalizeDelegatedAgentResult({ ok: true, content: 'safe child answer' }).result, { ok: true, content: 'safe child answer' });
const nullProto = Object.create(null); nullProto.ok = true; nullProto.content = '';
assert.equal(normalizeDelegatedAgentResult(nullProto).ok, true);
assert.deepEqual(normalizeDelegatedAgentResult({ ok: false, error: 'DELEGATED_TOOL_FAILED' }).result, { ok: false, error: 'DELEGATED_TOOL_FAILED' });
assert.equal(MAX_DELEGATED_CONTENT_CHARS, 32_768);
assert.equal(MAX_DELEGATED_ERROR_CHARS, 120);
expectInvalid(null, 'record');
expectInvalid(undefined, 'record');
expectInvalid([], 'record');
expectInvalid('text', 'record');
expectInvalid(new Date(), 'prototype');
expectInvalid(new (class Result { constructor() { this.ok = true; this.content = 'x'; } })(), 'prototype');
expectInvalid({ ok: true }, 'success_shape');
expectInvalid({ ok: true, content: 'x', extra: true }, 'success_shape');
expectInvalid({ ok: true, content: 7 }, 'content_type');
expectInvalid({ ok: true, content: 'x'.repeat(MAX_DELEGATED_CONTENT_CHARS + 1) }, 'content_size');
assert.equal(normalizeDelegatedAgentResult({ ok: true, content: 'x'.repeat(MAX_DELEGATED_CONTENT_CHARS) }).ok, true);
for (const content of ['Authorization: Bearer abcdefghijklmnop', 'github_pat_1234567890abcdefghijABCDEFGHIJ', 'nvapi-1234567890abcdefghijklmnopqrstuv', 'private_key: -----BEGIN PRIVATE KEY-----']) expectInvalid({ ok: true, content }, 'content_credential');
assert.equal(normalizeDelegatedAgentResult({ ok: true, content: 'GitHub PAT güvenliği hakkında inceleme.' }).ok, true);
expectInvalid({ ok: false }, 'failure_shape');
expectInvalid({ ok: false, error: 'FAILED', detail: 'raw provider text' }, 'failure_shape');
expectInvalid({ ok: false, error: '' }, 'error_size');
expectInvalid({ ok: false, error: 'A'.repeat(MAX_DELEGATED_ERROR_CHARS + 1) }, 'error_size');
expectInvalid({ ok: false, error: 'lowercase_error' }, 'error_format');
expectInvalid({ ok: false, error: 'ERROR WITH SPACES' }, 'error_format');
expectInvalid({ ok: false, error: 'ERROR:SECRET' }, 'error_format');
assert.equal(normalizeDelegatedAgentResult({ ok: false, error: 'A'.repeat(MAX_DELEGATED_ERROR_CHARS) }).ok, true);
expectInvalid({ ok: 'true', content: 'x' }, 'ok');
expectInvalid({ ok: 1, content: 'x' }, 'ok');
{
  let getterReads = 0;
  const value = { ok: true };
  Object.defineProperty(value, 'content', { enumerable: true, get() { getterReads += 1; throw new Error('getter must never execute'); } });
  expectInvalid(value, 'accessor');
  assert.equal(getterReads, 0);
}
{
  const proxy = new Proxy({ ok: true, content: 'x' }, { getOwnPropertyDescriptor() { throw new Error('hostile descriptor trap'); } });
  expectInvalid(proxy, 'introspection');
}
{
  const proxy = new Proxy({ ok: true, content: 'x' }, { getPrototypeOf() { throw new Error('hostile prototype trap'); } });
  expectInvalid(proxy, 'introspection');
}
console.log('delegated agent result credential policy tests passed');
