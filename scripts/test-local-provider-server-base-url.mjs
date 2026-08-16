import assert from 'node:assert/strict';
import { createLocalProviderServerRuntime } from '../lib/local-provider-server-runtime.mjs';

const dependencies = {
  nvidiaComplete: async () => ({}),
  nvidiaStream: async () => ({ async *[Symbol.asyncIterator]() {} }),
  nvidiaListModels: async () => []
};

for (const baseUrl of [
  'https://localhost:11434/v1',
  'http://user:password@localhost:11434/v1',
  'http://example.com:11434/v1',
  'http://10.0.0.5:11434/v1'
]) {
  assert.throws(
    () => createLocalProviderServerRuntime({
      env: {
        HAFIZE_LOCAL_PROVIDER_ENABLED: 'true',
        HAFIZE_LOCAL_PROVIDER_BASE_URL: baseUrl
      },
      ...dependencies
    }),
    /INVALID_LOCAL_PROVIDER_BASE_URL|LOCAL_PROVIDER_MUST_BE_LOOPBACK/
  );
}

assert.throws(
  () => createLocalProviderServerRuntime({
    env: {
      HAFIZE_LOCAL_PROVIDER_ENABLED: 'false',
      HAFIZE_LOCAL_PROVIDER_BASE_URL: 'http://127.0.0.1:11434/v1'
    },
    ...dependencies
  }),
  /LOCAL_PROVIDER_BASE_URL_REQUIRES_ENABLE/
);

const loopback = createLocalProviderServerRuntime({
  env: {
    HAFIZE_LOCAL_PROVIDER_ENABLED: 'true',
    HAFIZE_LOCAL_PROVIDER_BASE_URL: 'http://[::1]:11434/v1'
  },
  fetchImpl: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
  ...dependencies
});
assert.equal(loopback.configured, true);
assert.deepEqual(await loopback.listModels(), []);

console.log('local provider server base-url guard tests passed');
