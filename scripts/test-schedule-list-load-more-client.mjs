import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadApi() {
  const source = await readFile(new URL('../public/schedule-list.js', import.meta.url), 'utf8');
  const module = { exports: {} };
  const context = vm.createContext({ module, URLSearchParams, Intl, Date, Set, Map, Object, Number, String, Array, console });
  vm.runInContext(source, context, { filename: 'schedule-list.js' });
  return module.exports;
}

const api = await loadApi();
const calls = [];
const payloads = [
  { ok: true, schedules: [], listMeta: { snapshot: 'S'.repeat(43), nextOffset: 100, total: 240 } },
  { ok: true, schedules: [], listMeta: { snapshot: 'S'.repeat(43), nextOffset: 200, total: 240 } }
];
const fetchImpl = async (url, init) => {
  calls.push({ url, init });
  const payload = payloads.shift();
  return {
    ok: true,
    status: 200,
    async json() { return payload; }
  };
};
const client = api.createClient({ fetchImpl });

const first = await client.list();
assert.equal(first.ok, true);
assert.equal(calls[0].url, '/api/schedules?limit=100');
assert.deepEqual(calls[0].init, {
  method: 'GET',
  headers: { Accept: 'application/json' },
  credentials: 'same-origin',
  cache: 'no-store'
});

const snapshot = first.payload.listMeta.snapshot;
await client.list({ offset: 100, snapshot });
assert.equal(calls[1].url, `/api/schedules?limit=100&offset=100&snapshot=${snapshot}`);
assert.equal(calls[1].init.method, 'GET');
assert.equal(calls[1].init.credentials, 'same-origin');
assert.equal(calls[1].init.cache, 'no-store');
assert.equal(Object.prototype.hasOwnProperty.call(calls[1].init, 'body'), false);

let networkCalls = 0;
const rejectingClient = api.createClient({
  fetchImpl: async () => { networkCalls += 1; return { ok: true, status: 200, json: async () => ({}) }; }
});
await assert.rejects(() => rejectingClient.list({ offset: 100, snapshot: 'bad' }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);
assert.equal(networkCalls, 0, 'invalid snapshot must fail before network');

const hostile = api.normalizeListMeta({
  listMeta: {
    snapshot: 'javascript:alert(1)'.padEnd(43, 'A'),
    nextOffset: 100,
    total: 1000
  }
});
assert.equal(hostile.snapshot, null);
assert.equal(hostile.nextOffset, null);

const malformedResponseClient = api.createClient({
  fetchImpl: async () => ({ ok: false, status: 409, async json() { throw new Error('bad json'); } })
});
const malformed = await malformedResponseClient.list();
assert.equal(malformed.ok, false);
assert.equal(malformed.status, 409);
assert.deepEqual({ ...malformed.payload }, {});

console.log('schedule list load-more client tests passed');
