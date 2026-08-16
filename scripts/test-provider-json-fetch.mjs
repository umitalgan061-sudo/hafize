import assert from 'node:assert/strict';
import { fetchBoundedProviderJson } from '../lib/provider-json-fetch.mjs';

function headers(values = {}) {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return map.get(String(name).toLowerCase()) ?? null; } };
}

function streamBody(chunks, hooks = {}) {
  let index = 0;
  return {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true };
          return { done: false, value: chunks[index++] };
        },
        async cancel() { hooks.cancel?.(); },
        releaseLock() { hooks.release?.(); }
      };
    }
  };
}

const encoder = new TextEncoder();
let seenSignal = null;
const success = await fetchBoundedProviderJson({
  fetchImpl: async (_url, init) => {
    seenSignal = init.signal;
    return {
      ok: true,
      headers: headers({ 'content-length': 17 }),
      body: streamBody([encoder.encode('{"ok":true}'), encoder.encode('')])
    };
  },
  url: 'https://provider.example.test/data',
  init: { method: 'GET' },
  errorPrefix: 'TEST_PROVIDER',
  maxBytes: 64,
  timeoutMs: 1000
});
assert.deepEqual(success, { ok: true });
assert.equal(seenSignal instanceof AbortSignal, true);
assert.equal(seenSignal.aborted, false);

let declaredReads = 0;
await assert.rejects(
  () => fetchBoundedProviderJson({
    fetchImpl: async () => ({
      ok: true,
      headers: headers({ 'content-length': 4096 }),
      body: {
        getReader() {
          declaredReads += 1;
          throw new Error('body must not be opened');
        }
      }
    }),
    url: 'https://provider.example.test/declared-large',
    errorPrefix: 'TEST_PROVIDER',
    maxBytes: 1024,
    timeoutMs: 1000
  }),
  (error) => error?.code === 'TEST_PROVIDER:response-too-large'
);
assert.equal(declaredReads, 0, 'oversized content-length must fail before reading the stream');

let cancelled = 0;
let released = 0;
await assert.rejects(
  () => fetchBoundedProviderJson({
    fetchImpl: async () => ({
      ok: true,
      headers: headers(),
      body: streamBody([
        new Uint8Array(700),
        new Uint8Array(700)
      ], {
        cancel() { cancelled += 1; },
        release() { released += 1; }
      })
    }),
    url: 'https://provider.example.test/stream-large',
    errorPrefix: 'TEST_PROVIDER',
    maxBytes: 1024,
    timeoutMs: 1000
  }),
  (error) => error?.code === 'TEST_PROVIDER:response-too-large'
);
assert.equal(cancelled, 1, 'stream must be cancelled as soon as the byte budget is crossed');
assert.equal(released, 1);

await assert.rejects(
  () => fetchBoundedProviderJson({
    fetchImpl: async () => ({
      ok: true,
      headers: headers(),
      body: streamBody([encoder.encode('{not json}')])
    }),
    url: 'https://provider.example.test/invalid-json',
    errorPrefix: 'TEST_PROVIDER',
    maxBytes: 1024,
    timeoutMs: 1000
  }),
  (error) => error?.code === 'TEST_PROVIDER:response'
);

let timeoutAborts = 0;
await assert.rejects(
  () => fetchBoundedProviderJson({
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        timeoutAborts += 1;
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }),
    url: 'https://provider.example.test/hangs',
    errorPrefix: 'TEST_PROVIDER',
    maxBytes: 1024,
    timeoutMs: 10
  }),
  (error) => error?.code === 'TEST_PROVIDER:timeout'
);
assert.equal(timeoutAborts, 1, 'deadline must abort the underlying provider fetch');

await assert.rejects(
  () => fetchBoundedProviderJson({
    fetchImpl: async () => { throw new Error('socket detail must not escape'); },
    url: 'https://provider.example.test/network-error',
    errorPrefix: 'TEST_PROVIDER',
    maxBytes: 1024,
    timeoutMs: 1000
  }),
  (error) => error?.code === 'TEST_PROVIDER:network'
);

console.log('bounded provider JSON fetch tests passed');
