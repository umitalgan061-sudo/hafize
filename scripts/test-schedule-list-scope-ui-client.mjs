import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/schedule-list.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, {
  module,
  URLSearchParams,
  Intl,
  Date,
  Set,
  Map,
  Object,
  Number,
  String,
  Array,
  console
}, { filename: 'schedule-list.js' });
const api = module.exports;

const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url, init });
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        schedules: [],
        listMeta: {
          returned: 0,
          total: 120,
          offset: 0,
          nextOffset: 100,
          truncated: true,
          snapshot: 'A'.repeat(43)
        }
      };
    }
  };
};
const client = api.createClient({ fetchImpl });

await client.list({ scope: 'active' });
assert.equal(calls.length, 1);
assert.equal(calls[0].url, '/api/schedules?limit=100&view=summary&scope=active');
assert.deepEqual(calls[0].init, {
  method: 'GET',
  headers: { Accept: 'application/json' },
  credentials: 'same-origin',
  cache: 'no-store'
});
assert.equal('body' in calls[0].init, false);

await client.list({ scope: 'failed', offset: 100, snapshot: 'B'.repeat(43) });
assert.equal(calls.length, 2);
assert.equal(
  calls[1].url,
  `/api/schedules?limit=100&view=summary&scope=failed&offset=100&snapshot=${'B'.repeat(43)}`
);
assert.equal(calls[1].init.method, 'GET');
assert.equal(calls[1].init.credentials, 'same-origin');
assert.equal(calls[1].init.cache, 'no-store');

await client.list({ scope: '__proto__' });
assert.equal(calls[2].url, '/api/schedules?limit=100&view=summary&scope=all');

assert.throws(
  () => api.createClient({ fetchImpl: null }),
  /INVALID_SCHEDULE_LIST_FETCH/
);
assert.throws(
  () => api.createListPath({ scope: 'history', offset: 101, snapshot: null }),
  /INVALID_SCHEDULE_LIST_SNAPSHOT/
);

for (const scope of ['all', 'active', 'history', 'failed']) {
  const path = api.createListPath({ scope });
  const url = new URL(path, 'https://hafize.local');
  assert.equal(url.origin, 'https://hafize.local');
  assert.equal(url.pathname, '/api/schedules');
  assert.equal(url.searchParams.get('scope'), scope);
  assert.equal(url.searchParams.get('view'), 'summary');
  assert.equal(url.searchParams.get('limit'), '100');
  assert.equal(url.searchParams.has('token'), false);
  assert.equal(url.searchParams.has('ownerId'), false);
  assert.equal(url.searchParams.has('traceId'), false);
}

console.log('schedule list scope UI client tests passed');
