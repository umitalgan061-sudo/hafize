import assert from 'node:assert/strict';
import { parseListQuery } from '../lib/schedule-http-api.mjs';

const request = (url) => ({ url });

assert.deepEqual(parseListQuery(request('/api/schedules'), 200), { limit: 200, offset: 0 });
assert.deepEqual(parseListQuery(request('/api/schedules?limit=50'), 200), { limit: 50, offset: 0 });
assert.deepEqual(parseListQuery(request('/api/schedules?offset=200'), 200), { limit: 200, offset: 200 });
assert.deepEqual(parseListQuery(request('/api/schedules?limit=50&offset=150'), 200), { limit: 50, offset: 150 });
assert.deepEqual(parseListQuery(request('/api/schedules?offset=10000'), 200), { limit: 200, offset: 10000 });

for (const url of [
  '/api/schedules?limit=0',
  '/api/schedules?limit=201',
  '/api/schedules?limit=050',
  '/api/schedules?limit=-1',
  '/api/schedules?limit=1.5',
  '/api/schedules?offset=-1',
  '/api/schedules?offset=01',
  '/api/schedules?offset=10001',
  '/api/schedules?limit=10&limit=20',
  '/api/schedules?offset=1&offset=2',
  '/api/schedules?cursor=10',
  '/api/schedules?limit=10&extra=x'
]) {
  assert.equal(parseListQuery(request(url), 200), null, `must reject ${url}`);
}

assert.deepEqual(parseListQuery(request('/api/schedules?limit=500'), 500), { limit: 500, offset: 0 });
assert.equal(parseListQuery(request('/api/schedules?limit=500'), 200), null);
assert.equal(parseListQuery({ url: 'http://[invalid' }, 200), null);

console.log('schedule list pagination query: ok');
