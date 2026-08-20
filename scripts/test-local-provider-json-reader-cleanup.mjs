import assert from 'node:assert/strict';
import { createLocalOllamaProvider, LOCAL_PROVIDER_DEFAULTS } from '../lib/local-ollama-provider.mjs';

const REQUEST = Object.freeze({
  model: 'local:qwen2.5:7b',
  messages: Object.freeze([{ role: 'user', content: 'complete' }])
});

function responseFor(reader) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-type') return 'application/json';
        return null;
      }
    },
    body: { getReader: () => reader }
  };
}

function providerFor(reader) {
  return createLocalOllamaProvider({
    enabled: true,
    fetchImpl: async () => responseFor(reader)
  });
}

function readerFrom(items, { cancelThrows = false } = {}) {
  const state = { readCalls: 0, cancelCalls: 0, releaseCalls: 0, cancelReason: null };
  return {
    state,
    reader: {
      async read() {
        state.readCalls += 1;
        if (items.length === 0) return { done: true };
        return items.shift();
      },
      async cancel(reason) {
        state.cancelCalls += 1;
        state.cancelReason = reason;
        if (cancelThrows) throw new Error('cancel failed');
      },
      releaseLock() { state.releaseCalls += 1; }
    }
  };
}

{
  const json = JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] });
  const source = readerFrom([{ done: false, value: Buffer.from(json) }, { done: true }]);
  const result = await providerFor(source.reader).complete(REQUEST);
  assert.equal(result.choices[0].message.content, 'ok');
  assert.equal(source.state.cancelCalls, 0, 'natural JSON EOF is not redundantly cancelled');
  assert.equal(source.state.releaseCalls, 1, 'reader lock is released after natural EOF');
}

{
  const source = readerFrom([{ done: false, value: 'not-a-byte-chunk' }]);
  await assert.rejects(
    providerFor(source.reader).complete(REQUEST),
    (error) => error?.code === 'INVALID_LOCAL_PROVIDER_RESPONSE' && error?.status === 502
  );
  assert.equal(source.state.cancelCalls, 1, 'invalid response chunk cancels upstream reader');
  assert.equal(source.state.cancelReason, 'hafize-local-provider-read-failed');
  assert.equal(source.state.releaseCalls, 1);
}

{
  const oversized = Buffer.alloc(LOCAL_PROVIDER_DEFAULTS.maxCompletionJsonBytes + 1, 1);
  const source = readerFrom([{ done: false, value: oversized }]);
  await assert.rejects(
    providerFor(source.reader).complete(REQUEST),
    (error) => error?.code === 'LOCAL_PROVIDER_RESPONSE_TOO_LARGE' && error?.status === 502
  );
  assert.equal(source.state.cancelCalls, 1, 'oversized JSON stream cancels upstream reader exactly once');
  assert.equal(source.state.releaseCalls, 1);
}

{
  const source = readerFrom([{ done: false, value: 'invalid' }], { cancelThrows: true });
  await assert.rejects(
    providerFor(source.reader).complete(REQUEST),
    (error) => error?.code === 'INVALID_LOCAL_PROVIDER_RESPONSE',
    'best-effort cancel failure must not mask the validation error'
  );
  assert.equal(source.state.cancelCalls, 1);
  assert.equal(source.state.releaseCalls, 1, 'lock release still runs when cancel throws');
}

{
  const invalidJson = Buffer.from('{not-json');
  const source = readerFrom([{ done: false, value: invalidJson }, { done: true }]);
  await assert.rejects(
    providerFor(source.reader).complete(REQUEST),
    (error) => error?.code === 'INVALID_LOCAL_PROVIDER_RESPONSE' && error?.status === 502
  );
  assert.equal(source.state.cancelCalls, 0, 'JSON parse failure after natural EOF does not cancel an already-finished reader');
  assert.equal(source.state.releaseCalls, 1);
}

console.log('local provider JSON reader cleanup tests passed');
