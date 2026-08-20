import assert from 'node:assert/strict';
import { createLocalOllamaProvider } from '../lib/local-ollama-provider.mjs';

const REQUEST = { model: 'local:qwen2.5:7b', messages: [{ role: 'user', content: 'test' }] };

function bodyTracker({ asyncIterable = true, cancelThrows = false } = {}) {
  const state = { cancelCalls: 0, reasons: [] };
  const body = {
    async cancel(reason) {
      state.cancelCalls += 1;
      state.reasons.push(reason);
      if (cancelThrows) throw new Error('cancel failed');
    }
  };
  if (asyncIterable) {
    body[Symbol.asyncIterator] = function () {
      return { async next() { return { done: true }; } };
    };
  }
  return { body, state };
}

function providerWithResponse(response) {
  return createLocalOllamaProvider({ enabled: true, fetchImpl: async () => response });
}

{
  const tracked = bodyTracker();
  const provider = providerWithResponse({ ok: false, status: 503, headers: { get: () => null }, body: tracked.body });
  await assert.rejects(provider.complete(REQUEST), (error) => error?.code === 'LOCAL_PROVIDER_FAILED' && error?.status === 503);
  assert.equal(tracked.state.cancelCalls, 1);
  assert.equal(tracked.state.reasons[0], 'hafize-local-provider-http-error');
}

for (const operation of ['complete', 'stream']) {
  const tracked = bodyTracker();
  const provider = providerWithResponse({
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/plain' : null },
    body: tracked.body
  });
  await assert.rejects(provider[operation](REQUEST), (error) => error?.code === 'INVALID_LOCAL_PROVIDER_RESPONSE_TYPE' && error?.status === 502);
  assert.equal(tracked.state.cancelCalls, 1, `${operation} closes a response with the wrong media type`);
  assert.equal(tracked.state.reasons[0], 'hafize-local-provider-invalid-response-type');
}

{
  const tracked = bodyTracker({ asyncIterable: false });
  const provider = providerWithResponse({
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/event-stream' : null },
    body: tracked.body
  });
  await assert.rejects(provider.stream(REQUEST), (error) => error?.code === 'INVALID_LOCAL_PROVIDER_STREAM' && error?.status === 502);
  assert.equal(tracked.state.cancelCalls, 1);
  assert.equal(tracked.state.reasons[0], 'hafize-local-provider-invalid-stream');
}

{
  const tracked = bodyTracker({ cancelThrows: true });
  const provider = providerWithResponse({ ok: false, status: 429, headers: { get: () => null }, body: tracked.body });
  await assert.rejects(
    provider.complete(REQUEST),
    (error) => error?.code === 'LOCAL_PROVIDER_FAILED' && error?.status === 429,
    'best-effort body cancellation must not mask the original HTTP failure'
  );
  assert.equal(tracked.state.cancelCalls, 1);
}

console.log('local provider rejected response cleanup tests passed');
