import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/chat-run-controller.js');

assert.deepEqual(api.SSE_STREAM_PATHS, ['/api/chat', '/api/agent/run']);
assert.equal(api.MAX_SSE_PENDING_CHARS, 256 * 1024);

assert.equal(api.requestMethod('/api/chat'), 'GET');
assert.equal(api.requestMethod('/api/chat', { method: 'post' }), 'POST');
assert.equal(api.requestMethod({ method: 'POST' }), 'POST');
assert.equal(api.requestUrl('/api/chat'), '/api/chat');
assert.equal(api.requestUrl({ url: 'https://hafize.test/api/chat' }), 'https://hafize.test/api/chat');
assert.equal(api.requestUrl(null), '');

const origin = 'https://hafize.test';
assert.equal(api.shouldGuardSseRequest('/api/chat', { method: 'POST' }, origin), true);
assert.equal(api.shouldGuardSseRequest('/api/agent/run', { method: 'POST' }, origin), true);
assert.equal(api.shouldGuardSseRequest('https://hafize.test/api/chat', { method: 'POST' }, origin), true);
assert.equal(api.shouldGuardSseRequest('/api/chat', { method: 'GET' }, origin), false);
assert.equal(api.shouldGuardSseRequest('/api/chat?x=1', { method: 'POST' }, origin), false);
assert.equal(api.shouldGuardSseRequest('/api/chat#fragment', { method: 'POST' }, origin), false);
assert.equal(api.shouldGuardSseRequest('/api/chat/extra', { method: 'POST' }, origin), false);
assert.equal(api.shouldGuardSseRequest('/api/agent/runner', { method: 'POST' }, origin), false);
assert.equal(api.shouldGuardSseRequest('https://evil.test/api/chat', { method: 'POST' }, origin), false);
assert.equal(api.shouldGuardSseRequest('not a url%', { method: 'POST' }, origin), false);
assert.equal(api.shouldGuardSseRequest('/api/chat', { method: 'POST' }, ''), false);

{
  const normalizer = api.createSseFrameNormalizer();
  assert.deepEqual(normalizer.push('data: {"a":1}\n\n'), ['data: {"a":1}\n\n']);
  assert.deepEqual(normalizer.snapshot(), { pendingChars: 0, closed: false });
  assert.deepEqual(normalizer.finish(), []);
  assert.deepEqual(normalizer.snapshot(), { pendingChars: 0, closed: true });
  assert.throws(() => normalizer.push('data: later'), /SSE_NORMALIZER_CLOSED/);
  assert.throws(() => normalizer.finish(), /SSE_NORMALIZER_CLOSED/);
}

{
  const normalizer = api.createSseFrameNormalizer();
  assert.deepEqual(normalizer.push('event: message\r'), []);
  assert.deepEqual(normalizer.push('\ndata: {"choices":['), []);
  assert.deepEqual(normalizer.push('{"delta":{"content":"Mer"}}]}\r\n\r'), []);
  assert.deepEqual(normalizer.push('\n'), [
    'event: message\ndata: {"choices":[{"delta":{"content":"Mer"}}]}\n\n'
  ]);
  assert.deepEqual(normalizer.finish(), []);
}

{
  const normalizer = api.createSseFrameNormalizer();
  assert.deepEqual(normalizer.push('event: message\ndata: {"choices":[{"delta":{"content":"son"}}]}'), []);
  const frames = normalizer.finish();
  assert.deepEqual(frames, ['event: message\ndata: {"choices":[{"delta":{"content":"son"}}]}\n\n']);
}

{
  const normalizer = api.createSseFrameNormalizer();
  assert.deepEqual(normalizer.push('data: first\ndata: second\n\n: keepalive\n\n'), [
    'data: first\ndata: second\n\n',
    ': keepalive\n\n'
  ]);
  assert.deepEqual(normalizer.finish('data: [DONE]'), ['data: [DONE]\n\n']);
}

{
  const normalizer = api.createSseFrameNormalizer({ maxPendingChars: 1024 });
  assert.deepEqual(normalizer.push('x'.repeat(1024)), []);
  assert.throws(() => normalizer.push('x'), /SSE_FRAME_TOO_LARGE/);
}

{
  const normalizer = api.createSseFrameNormalizer({ maxPendingChars: 1024 });
  assert.throws(() => normalizer.push(`${'x'.repeat(1025)}\n\n`), /SSE_FRAME_TOO_LARGE/);
}

assert.throws(() => api.createSseFrameNormalizer({ maxPendingChars: 1023 }), /INVALID_SSE_PENDING_LIMIT/);
assert.throws(() => api.createSseFrameNormalizer({ maxPendingChars: api.MAX_SSE_PENDING_CHARS + 1 }), /INVALID_SSE_PENDING_LIMIT/);
assert.throws(() => api.createSseFrameNormalizer({ maxPendingChars: 1.5 }), /INVALID_SSE_PENDING_LIMIT/);

console.log('SSE stream integrity normalizer tests passed');
