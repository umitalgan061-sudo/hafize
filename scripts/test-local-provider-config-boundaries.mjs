import assert from 'node:assert/strict';
import { createLocalOllamaProvider } from '../lib/local-ollama-provider.mjs';

const noFetch = async () => { throw new Error('network must not be reached'); };

for (const baseUrl of [
  'https://127.0.0.1:11434/v1',
  'http://192.168.1.10:11434/v1',
  'http://ollama.internal:11434/v1',
  'http://user:pass@127.0.0.1:11434/v1',
  'http://127.0.0.1:11434/v1?token=secret',
  'http://127.0.0.1:11434/v1#fragment',
  'not a url'
]) {
  assert.throws(
    () => createLocalOllamaProvider({ enabled: true, baseUrl, fetchImpl: noFetch }),
    (error) => ['INVALID_LOCAL_PROVIDER_BASE_URL', 'LOCAL_PROVIDER_MUST_BE_LOOPBACK'].includes(error?.code),
    baseUrl
  );
}

for (const baseUrl of [
  'http://127.0.0.1:11434/v1/',
  'http://localhost:11434/v1',
  'http://[::1]:11434/v1'
]) {
  const provider = createLocalOllamaProvider({ enabled: true, baseUrl, fetchImpl: noFetch });
  assert.equal(provider.configured, true);
}

for (const jsonTimeoutMs of [0, -1, 120_001, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(
    () => createLocalOllamaProvider({ enabled: true, jsonTimeoutMs, fetchImpl: noFetch }),
    (error) => error?.code === 'INVALID_LOCAL_PROVIDER_JSON_TIMEOUT'
  );
}

for (const jsonTimeoutMs of [1, 30_000, 120_000]) {
  const provider = createLocalOllamaProvider({ enabled: true, jsonTimeoutMs, fetchImpl: noFetch });
  assert.equal(provider.configured, true);
}

const disabled = createLocalOllamaProvider({ enabled: 'false', fetchImpl: noFetch });
assert.equal(disabled.configured, false);
await assert.rejects(
  disabled.complete({ model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] }),
  (error) => error?.code === 'LOCAL_PROVIDER_NOT_ENABLED' && error?.status === 503
);

console.log('local provider configuration boundary tests passed');
