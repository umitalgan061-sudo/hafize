import assert from 'node:assert/strict';
import { parseListQuery } from '../lib/schedule-http-api.mjs';

const request = (url) => ({ url });
const base = { offset: 0, snapshot: null, view: null, scope: 'all' };

assert.deepEqual(parseListQuery(request('/api/schedules'), 200), { limit: 200, ...base });
assert.deepEqual(parseListQuery(request('/api/schedules?limit=50'), 200), { limit: 50, ...base });
assert.deepEqual(parseListQuery(request('/api/schedules?scope=active'), 200), { limit: 200, ...base, scope: 'active' });
assert.deepEqual(parseListQuery(request('/api/schedules?scope=history&view=summary'), 200), {
  limit: 200, offset: 0, snapshot: null, view: 'summary', scope: 'history'
});
assert.deepEqual(parseListQuery(request('/api/schedules?scope=failed&limit=1'), 200), {
  limit: 1, offset: 0, snapshot: null, view: null, scope: 'failed'
});

const snapshot = 'A'.repeat(43);
assert.deepEqual(parseListQuery(request(`/api/schedules?limit=50&offset=150&snapshot=${snapshot}&scope=failed`), 200), {
  limit: 50, offset: 150, snapshot, view: null, scope: 'failed'
});
assert.deepEqual(parseListQuery(request(`/api/schedules?offset=10000&snapshot=${snapshot}`), 200), {
  limit: 200, offset: 10000, snapshot, view: null, scope: 'all'
});

for (const url of [
  '/api/schedules?limit=0',
  '/api/schedules?limit=201',
  '/api/schedules?limit=050',
  '/api/schedules?limit=-1',
  '/api/schedules?limit=1.5',
  '/api/schedules?offset=-1',
  '/api/schedules?offset=01',
  '/api/schedules?offset=10001',
  '/api/schedules?offset=1',
  `/api/schedules?snapshot=${snapshot}`,
  '/api/schedules?limit=10&limit=20',
  '/api/schedules?scope=active&scope=failed',
  '/api/schedules?scope=',
  '/api/schedules?scope=ACTIVE',
  '/api/schedules?scope=scheduled',
  '/api/schedules?scope=all,failed',
  '/api/schedules?cursor=10',
  '/api/schedules?limit=10&extra=x'
]) {
  assert.equal(parseListQuery(request(url), 200), null, `must reject ${url}`);
}

assert.deepEqual(parseListQuery(request('/api/schedules?limit=500&scope=all'), 500), {
  limit: 500, offset: 0, snapshot: null, view: null, scope: 'all'
});
assert.equal(parseListQuery(request('/api/schedules?limit=500'), 200), null);
assert.equal(parseListQuery({ url: 'http://[invalid' }, 200), null);

console.log('schedule list pagination query: ok');
