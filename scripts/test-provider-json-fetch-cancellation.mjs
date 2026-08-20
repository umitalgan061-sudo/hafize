import assert from 'node:assert/strict';
import { fetchBoundedProviderJson } from '../lib/provider-json-fetch.mjs';

function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return normalized.get(String(name).toLowerCase()) ?? null; } };
}

function jsonResponse(value, overrides = {}) {
  return {
    ok: true,
    status: 200,
    headers: headers(),
    async json() { return value; },
    ...overrides
  };
}

{
  const outer = new AbortController();
  outer.abort('caller-left');
  let fetchCalls = 0;
  await assert.rejects(
    fetchBoundedProviderJson({
      fetchImpl: async () => { fetchCalls += 1; return jsonResponse({ ok: true }); },
      url: 'https://provider.example.test/pre-abort',
      errorPrefix: 'TEST_PROVIDER_CANCEL',
      maxBytes: 1024,
      timeoutMs: 1000,
      signal: outer.signal
    }),
    (error) => error?.code === 'TEST_PROVIDER_CANCEL:cancelled'
  );
  assert.equal(fetchCalls, 0, 'pre-aborted caller must prevent provider network egress');
}

{
  const outer = new AbortController();
  let providerSignal = null;
  let aborts = 0;
  const pending = fetchBoundedProviderJson({
    fetchImpl: async (_url, init) => {
      providerSignal = init.signal;
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborts += 1;
          const error = new Error('provider fetch aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    },
    url: 'https://provider.example.test/cancel',
    errorPrefix: 'TEST_PROVIDER_CANCEL',
    maxBytes: 1024,
    timeoutMs: 10_000,
    signal: outer.signal
  });
  await Promise.resolve();
  assert.equal(providerSignal?.aborted, false);
  outer.abort('navigation');
  await assert.rejects(pending, (error) => error?.code === 'TEST_PROVIDER_CANCEL:cancelled');
  assert.equal(providerSignal.aborted, true);
  assert.equal(aborts, 1, 'parent cancellation aborts the actual provider fetch exactly once');
}

{
  const listeners = new Set();
  let removed = 0;
  const signal = {
    aborted: false,
    addEventListener(type, listener) {
      assert.equal(type, 'abort');
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'abort');
      if (listeners.delete(listener)) removed += 1;
    }
  };
  const result = await fetchBoundedProviderJson({
    fetchImpl: async () => jsonResponse({ ok: true }),
    url: 'https://provider.example.test/cleanup',
    errorPrefix: 'TEST_PROVIDER_CANCEL',
    maxBytes: 1024,
    timeoutMs: 1000,
    signal
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(listeners.size, 0);
  assert.equal(removed, 1, 'parent abort listener must be removed after success');
}

{
  const outer = new AbortController();
  let cancelCalls = 0;
  await assert.rejects(
    fetchBoundedProviderJson({
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        headers: headers(),
        body: { async cancel() { cancelCalls += 1; } }
      }),
      url: 'https://provider.example.test/http-error',
      errorPrefix: 'TEST_PROVIDER_CANCEL',
      maxBytes: 1024,
      timeoutMs: 1000,
      signal: outer.signal
    }),
    (error) => error?.code === 'TEST_PROVIDER_CANCEL:http'
  );
  assert.equal(cancelCalls, 1, 'rejected provider response body must be closed');
}

{
  let cancelCalls = 0;
  await assert.rejects(
    fetchBoundedProviderJson({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: headers({ 'content-length': 4096 }),
        body: { async cancel() { cancelCalls += 1; } }
      }),
      url: 'https://provider.example.test/declared-large',
      errorPrefix: 'TEST_PROVIDER_CANCEL',
      maxBytes: 128,
      timeoutMs: 1000
    }),
    (error) => error?.code === 'TEST_PROVIDER_CANCEL:response-too-large'
  );
  assert.equal(cancelCalls, 1, 'declared oversized provider body must be closed without reading');
}

{
  let timeoutSignal = null;
  await assert.rejects(
    fetchBoundedProviderJson({
      fetchImpl: async (_url, init) => {
        timeoutSignal = init.signal;
        return await new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('deadline');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
        });
      },
      url: 'https://provider.example.test/timeout',
      errorPrefix: 'TEST_PROVIDER_CANCEL',
      maxBytes: 1024,
      timeoutMs: 5
    }),
    (error) => error?.code === 'TEST_PROVIDER_CANCEL:timeout'
  );
  assert.equal(timeoutSignal?.aborted, true, 'deadline still aborts provider fetch');
}

await assert.rejects(
  fetchBoundedProviderJson({
    fetchImpl: async () => jsonResponse({ ok: true }),
    url: 'https://provider.example.test/bad-signal',
    errorPrefix: 'TEST_PROVIDER_CANCEL',
    maxBytes: 1024,
    timeoutMs: 1000,
    signal: { aborted: false }
  }),
  /INVALID_PROVIDER_JSON_FETCH:signal/
);

console.log('provider JSON cancellation and cleanup tests passed');
