import assert from 'node:assert/strict';
import { createPersonalMemoryServerRuntime } from '../lib/personal-memory-server-runtime.mjs';

let controlCalls = 0;
let apiCalls = 0;
let handled = null;

const disabled = await createPersonalMemoryServerRuntime({
  env: { TEST: 'disabled' },
  readJson: async () => ({}),
  async createControlRuntime({ env }) {
    controlCalls += 1;
    assert.equal(env.TEST, 'disabled');
    return { configured: false, authenticate() { return null; } };
  },
  createHttpApi() {
    apiCalls += 1;
    throw new Error('disabled runtime must not create HTTP API');
  }
});
assert.equal(disabled.configured, false);
assert.equal(controlCalls, 1);
assert.equal(apiCalls, 0);
assert.deepEqual(await disabled.handle({ pathname: '/api/memory' }), { matched: false });

const fakeRuntime = {
  configured: true,
  authenticate() { return { ownerId: 'opaque-owner' }; },
  memory: {}
};
const enabled = await createPersonalMemoryServerRuntime({
  env: { TEST: 'enabled' },
  readJson: async () => ({ explicitUserIntent: true }),
  async createControlRuntime({ env }) {
    controlCalls += 1;
    assert.equal(env.TEST, 'enabled');
    return fakeRuntime;
  },
  createHttpApi({ runtime, readJson }) {
    apiCalls += 1;
    assert.equal(runtime, fakeRuntime);
    assert.equal(typeof readJson, 'function');
    return {
      async handle(input) {
        handled = input;
        return { matched: true, status: 200, body: { ok: true } };
      }
    };
  }
});
assert.equal(enabled.configured, true);
const request = { method: 'GET', pathname: '/api/memory', headers: { authorization: 'Bearer redacted' } };
assert.deepEqual(await enabled.handle(request), { matched: true, status: 200, body: { ok: true } });
assert.equal(handled, request);
assert.equal(controlCalls, 2);
assert.equal(apiCalls, 1);

await assert.rejects(
  () => createPersonalMemoryServerRuntime({ readJson: null }),
  /INVALID_MEMORY_SERVER_RUNTIME:readJson/
);
await assert.rejects(
  () => createPersonalMemoryServerRuntime({
    readJson: async () => ({}),
    createControlRuntime: async () => null
  }),
  /INVALID_MEMORY_SERVER_RUNTIME:runtime/
);
await assert.rejects(
  () => createPersonalMemoryServerRuntime({
    readJson: async () => ({}),
    createControlRuntime: async () => ({ configured: true }),
    createHttpApi: () => null
  }),
  /INVALID_MEMORY_SERVER_RUNTIME:api/
);

console.log('personal memory server runtime tests passed');
