import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-runtime-status.js');

const health = {
  scheduleWorkerConfigured: true,
  scheduleApiConfigured: true,
  scheduleStorageDurable: true,
  scheduleLeaseConfigured: true
};

function trackedSignal() {
  const listeners = new Set();
  return {
    signal: {
      aborted: false,
      addEventListener(name, fn) { assert.equal(name, 'abort'); listeners.add(fn); },
      removeEventListener(name, fn) { assert.equal(name, 'abort'); listeners.delete(fn); }
    },
    count: () => listeners.size
  };
}

{
  const outer = trackedSignal();
  let clears = 0;
  const client = api.createClient({
    fetchImpl: async () => ({ ok: true, json: async () => health }),
    setTimeoutImpl() { return 31; },
    clearTimeoutImpl(id) { assert.equal(id, 31); clears += 1; }
  });
  assert.deepEqual(await client.read({ signal: outer.signal }), health);
  assert.equal(outer.count(), 0, 'success removes external abort listener');
  assert.equal(clears, 1, 'success clears timeout');
}

{
  const outer = trackedSignal();
  let clears = 0;
  const client = api.createClient({
    fetchImpl: async () => { throw new Error('network down'); },
    setTimeoutImpl() { return 32; },
    clearTimeoutImpl(id) { assert.equal(id, 32); clears += 1; }
  });
  await assert.rejects(client.read({ signal: outer.signal }), /network down/);
  assert.equal(outer.count(), 0, 'network failure removes external abort listener');
  assert.equal(clears, 1, 'network failure clears timeout');
}

{
  const client = api.createClient({ fetchImpl: async () => ({ ok: false, json: async () => ({}) }) });
  await assert.rejects(client.read(), /SCHEDULE_STATUS_HTTP_ERROR/);
}

{
  const client = api.createClient({ fetchImpl: async () => ({ ok: true, json: async () => ({ scheduleWorkerConfigured: true }) }) });
  await assert.rejects(client.read(), /SCHEDULE_STATUS_INVALID_RESPONSE/);
}

console.log('schedule runtime status client cleanup tests passed');
