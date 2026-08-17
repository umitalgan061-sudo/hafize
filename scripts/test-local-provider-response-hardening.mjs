import assert from 'node:assert/strict';
import { createLocalOllamaProvider, LOCAL_PROVIDER_DEFAULTS } from '../lib/local-ollama-provider.mjs';

function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return normalized.get(String(name).toLowerCase()) ?? null; } };
}

function jsonResponse(payload, { contentType = 'application/json; charset=utf-8', contentLength, status = 200 } = {}) {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers({ 'content-type': contentType, ...(contentLength === undefined ? {} : { 'content-length': contentLength }) }),
    async text() { return text; }
  };
}

const calls = [];
const provider = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] });
  }
});

const result = await provider.complete({
  model: 'local:llama3.2:3b',
  messages: [{ role: 'user', content: 'Merhaba' }]
});
assert.equal(result.choices[0].message.content, 'ok');
assert.equal(calls.length, 1);
assert.equal(calls[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
assert.equal(calls[0].init.redirect, 'error');
assert.equal(calls[0].init.headers.Accept, 'application/json');
assert.equal(JSON.parse(calls[0].init.body).model, 'llama3.2:3b');

await assert.rejects(
  createLocalOllamaProvider({ enabled: true, fetchImpl: async () => jsonResponse({}, { contentType: 'text/html' }) })
    .complete({ model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] }),
  (error) => error?.code === 'INVALID_LOCAL_PROVIDER_RESPONSE_TYPE' && error?.status === 502
);

await assert.rejects(
  createLocalOllamaProvider({
    enabled: true,
    fetchImpl: async () => jsonResponse(
      { choices: [{ message: { role: 'assistant', content: 'x' } }] },
      { contentLength: LOCAL_PROVIDER_DEFAULTS.maxCompletionJsonBytes + 1 }
    )
  }).complete({ model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] }),
  (error) => error?.code === 'LOCAL_PROVIDER_RESPONSE_TOO_LARGE' && error?.status === 502
);

await assert.rejects(
  createLocalOllamaProvider({
    enabled: true,
    jsonTimeoutMs: 20,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
    })
  }).complete({ model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] }),
  (error) => error?.code === 'LOCAL_PROVIDER_TIMEOUT' && error?.status === 504
);

const controller = new AbortController();
const cancelled = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  })
}).complete({ model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] }, { signal: controller.signal });
controller.abort();
await assert.rejects(cancelled, (error) => error?.code === 'LOCAL_PROVIDER_CANCELLED' && error?.status === 499);

for (const model of ['local:../bad model', 'local:💥', `local:${'a'.repeat(161)}`]) {
  await assert.rejects(
    provider.complete({ model, messages: [{ role: 'user', content: 'x' }] }),
    (error) => error?.code === 'INVALID_LOCAL_PROVIDER_MODEL'
  );
}

assert.equal(LOCAL_PROVIDER_DEFAULTS.maxCompletionJsonBytes, 4 * 1024 * 1024);
assert.equal(LOCAL_PROVIDER_DEFAULTS.jsonTimeoutMs, 30_000);
console.log('local provider JSON response hardening tests passed');
