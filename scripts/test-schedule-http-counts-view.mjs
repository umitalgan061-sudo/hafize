import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

let listCalls = 0;
const api = createScheduleHttpApi({
  authenticator: { authenticate: () => ({ ok: true, principal: { subject: 'owner_alice' } }) },
  sessionAuthenticator: null,
  commands: {
    async list({ principal }) {
      listCalls += 1;
      assert.equal(principal.subject, 'owner_alice');
      return {
        ok: true,
        schedules: [
          { scheduleId: 'a', status: 'scheduled', task: 'secret task one', ownerId: 'owner_alice', traceId: 'trace_a' },
          { scheduleId: 'b', status: 'failed', task: 'secret task two', ownerId: 'owner_alice', traceId: 'trace_b', lastError: 'private provider error' },
          { scheduleId: 'c', status: 'cancelled', task: 'secret task three', ownerId: 'owner_alice', traceId: 'trace_c' }
        ]
      };
    },
    create: async () => ({ ok: false }),
    reschedule: async () => ({ ok: false }),
    cancel: async () => ({ ok: false })
  },
  readJson: async () => ({}),
  listLimit: 100
});

const result = await api.handle({
  request: { url: '/api/schedules?view=counts' },
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(result.status, 200);
assert.equal(result.body.ok, true);
assert.equal(result.body.view, 'counts');
assert.deepEqual(result.body.schedules, []);
assert.deepEqual(result.body.listMeta.scopeCounts, { all: 3, active: 1, history: 2, failed: 1 });
const serialized = JSON.stringify(result.body);
for (const privateValue of ['secret task one', 'secret task two', 'secret task three', 'owner_alice', 'trace_a', 'trace_b', 'trace_c', 'private provider error']) {
  assert.equal(serialized.includes(privateValue), false, `counts response leaked ${privateValue}`);
}
assert.equal(listCalls, 1);

for (const query of [
  '?view=counts&limit=1',
  '?view=counts&offset=0',
  '?view=counts&scope=active',
  '?view=counts&snapshot=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '?view=counts&view=counts',
  '?view=unknown'
]) {
  const before = listCalls;
  const invalid = await api.handle({ request: { url: `/api/schedules${query}` }, method: 'GET', pathname: '/api/schedules', headers: {} });
  assert.equal(invalid.status, 400, query);
  assert.equal(listCalls, before, `invalid query reached commands.list: ${query}`);
}

process.stdout.write('schedule HTTP counts view tests passed\n');
