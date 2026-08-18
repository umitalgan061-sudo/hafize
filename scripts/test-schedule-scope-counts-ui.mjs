import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ui = require('../public/schedule-scope-counts-ui.js');

assert.deepEqual(ui.normalizeCounts({ all: 8, active: 3, history: 5, failed: 2 }), { all: 8, active: 3, history: 5, failed: 2 });
for (const invalid of [
  null,
  [],
  {},
  { all: 8, active: 3, history: 4, failed: 2 },
  { all: 8, active: 3, history: 5, failed: 6 },
  { all: 8, active: -1, history: 9, failed: 0 },
  { all: 8.5, active: 3, history: 5, failed: 2 },
  { all: ui.MAX_COUNT + 1, active: 0, history: ui.MAX_COUNT + 1, failed: 0 }
]) assert.equal(ui.normalizeCounts(invalid), null);

const calls = [];
const client = ui.createClient({
  fetchImpl: async (path, init) => {
    calls.push({ path, init });
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, schedules: [], listMeta: { scopeCounts: { all: 12, active: 4, history: 8, failed: 3 } }, view: 'counts' };
      }
    };
  }
});
const result = await client.read();
assert.equal(result.ok, true);
assert.deepEqual(result.counts, { all: 12, active: 4, history: 8, failed: 3 });
assert.equal(calls.length, 1);
assert.equal(calls[0].path, '/api/schedules?view=counts');
assert.equal(calls[0].init.method, 'GET');
assert.equal(calls[0].init.credentials, 'same-origin');
assert.equal(calls[0].init.cache, 'no-store');
assert.deepEqual(calls[0].init.headers, { Accept: 'application/json' });
assert.equal('body' in calls[0].init, false);

const malformed = await ui.createClient({
  fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ listMeta: { scopeCounts: { all: 3, active: 3, history: 3, failed: 0 } } }) })
}).read();
assert.equal(malformed.ok, true);
assert.equal(malformed.counts, null);

const brokenJson = await ui.createClient({
  fetchImpl: async () => ({ ok: false, status: 401, json: async () => { throw new Error('bad json'); } })
}).read();
assert.equal(brokenJson.ok, false);
assert.equal(brokenJson.status, 401);
assert.equal(brokenJson.counts, null);

assert.throws(() => ui.createClient({ fetchImpl: null }), /INVALID_SCHEDULE_SCOPE_COUNTS_FETCH/);
process.stdout.write('schedule scope counts UI client tests passed\n');
