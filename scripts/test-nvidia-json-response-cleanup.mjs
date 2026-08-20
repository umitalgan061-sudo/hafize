import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime } from '../lib/model-provider-production-runtime.mjs';

function makeRuntime(fetchImpl, options = {}) {
  return createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-only-key' },
    fetchImpl,
    jsonTimeoutMs: 5_000,
    createLocalRuntime({ nvidiaComplete, nvidiaStream, nvidiaListModels }) {
      return {
        configured: false,
        defaultProvider: 'nvidia',
        nvidiaComplete,
        nvidiaStream,
        nvidiaListModels
      };
    },
    createBoundary({ runtime }) {
      return {
        complete: runtime.nvidiaComplete,
        stream: runtime.nvidiaStream,
        listModels: runtime.nvidiaListModels
      };
    },
    ...options
  });
}

function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return normalized.get(String(name).toLowerCase()) ?? null; } };
}

function cancellableBody({ cancelError = null } = {}) {
  const state = { calls: 0, reasons: [] };
  return {
    state,
    body: {
      async cancel(reason) {
        state.calls += 1;
        state.reasons.push(reason);
        if (cancelError) throw cancelError;
      }
    }
  };
}

function jsonResponse(payload, overrides = {}) {
  const encoded = Buffer.from(JSON.stringify(payload));
  let index = 0;
  const state = { cancelCalls: 0, releaseCalls: 0, cancelReason: null };
  return {
    state,
    response: {
      ok: true,
      status: 200,
      headers: headers({ 'content-type': 'application/json', 'content-length': encoded.length }),
      body: {
        getReader() {
          return {
            async read() {
              if (index > 0) return { done: true, value: undefined };
              index += 1;
              return { done: false, value: new Uint8Array(encoded) };
            },
            async cancel(reason) { state.cancelCalls += 1; state.cancelReason = reason; },
            releaseLock() { state.releaseCalls += 1; }
          };
        }
      },
      ...overrides
    }
  };
}

{
  const body = cancellableBody();
  const runtime = makeRuntime(async () => ({
    ok: false,
    status: 429,
    headers: headers({ 'content-type': 'application/json' }),
    body: body.body
  }));

  await assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => {
      assert.equal(error.code, 'NVIDIA_CHAT_ERROR');
      assert.equal(error.status, 429);
      return true;
    }
  );
  assert.equal(body.state.calls, 1, 'non-2xx completion body is cancelled');
  assert.equal(body.state.reasons[0]?.code, 'NVIDIA_CHAT_ERROR');
}

{
  const body = cancellableBody();
  const runtime = makeRuntime(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'text/html' }),
    body: body.body
  }));

  await assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => error?.code === 'INVALID_NVIDIA_RESPONSE_TYPE' && error?.status === 502
  );
  assert.equal(body.state.calls, 1, 'wrong completion media type closes upstream body');
}

{
  const body = cancellableBody();
  const runtime = makeRuntime(async () => ({
    ok: true,
    status: 200,
    headers: headers({
      'content-type': 'application/json',
      'content-length': 4 * 1024 * 1024 + 1
    }),
    body: body.body
  }));

  await assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => error?.code === 'NVIDIA_RESPONSE_TOO_LARGE'
  );
  assert.equal(body.state.calls, 1, 'declared oversized completion body is cancelled before reading');
}

{
  const state = { cancelCalls: 0, releaseCalls: 0, reason: null };
  const runtime = makeRuntime(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'application/json' }),
    body: {
      getReader() {
        return {
          async read() { return { done: false, value: 'not-bytes' }; },
          async cancel(reason) { state.cancelCalls += 1; state.reason = reason; },
          releaseLock() { state.releaseCalls += 1; }
        };
      }
    }
  }));

  await assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => error?.code === 'INVALID_NVIDIA_RESPONSE'
  );
  assert.equal(state.cancelCalls, 1, 'malformed streamed JSON chunk cancels reader');
  assert.equal(state.reason?.code, 'INVALID_NVIDIA_RESPONSE');
  assert.equal(state.releaseCalls, 1, 'reader lock is released after malformed chunk');
}

{
  const body = cancellableBody({ cancelError: new Error('cleanup failed') });
  const runtime = makeRuntime(async () => ({
    ok: false,
    status: 503,
    headers: headers({ 'content-type': 'application/json' }),
    body: body.body
  }));

  await assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => {
      assert.equal(error.code, 'NVIDIA_CHAT_ERROR');
      assert.equal(error.status, 503);
      assert.notEqual(error.message, 'cleanup failed');
      return true;
    }
  );
  assert.equal(body.state.calls, 1, 'cleanup is attempted even when cancellation itself fails');
}

{
  const body = cancellableBody();
  const runtime = makeRuntime(async () => ({
    ok: false,
    status: 502,
    headers: headers({ 'content-type': 'application/json' }),
    body: body.body
  }));

  await assert.rejects(runtime.listModels(), (error) => error?.code === 'NVIDIA_CHAT_ERROR' && error?.status === 502);
  assert.equal(body.state.calls, 1, 'non-2xx model-list body is cancelled');
}

{
  const body = cancellableBody();
  const runtime = makeRuntime(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'text/plain' }),
    body: body.body
  }));

  await assert.rejects(runtime.listModels(), (error) => error?.code === 'INVALID_NVIDIA_RESPONSE_TYPE');
  assert.equal(body.state.calls, 1, 'wrong model-list media type closes upstream body');
}

{
  const fixture = jsonResponse({ choices: [{ message: { content: 'ok' } }] });
  const runtime = makeRuntime(async () => fixture.response);
  const value = await runtime.complete({ model: 'nvidia/test', messages: [] });
  assert.equal(value.choices[0].message.content, 'ok');
  assert.equal(fixture.state.cancelCalls, 0, 'fully consumed successful response is not cancelled');
  assert.equal(fixture.state.releaseCalls, 1);
}

{
  const fixture = jsonResponse({ data: [{ id: 'nvidia/a' }, { id: 'nvidia/a' }, { id: 'nvidia/b' }] });
  const runtime = makeRuntime(async () => fixture.response);
  assert.deepEqual(await runtime.listModels(), ['nvidia/a', 'nvidia/b']);
  assert.equal(fixture.state.cancelCalls, 0, 'successful models response drains normally');
}

console.log('nvidia JSON response cleanup tests passed');
