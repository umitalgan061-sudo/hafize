import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const calls = [];
const api = createScheduleHttpApi({
  authenticator: { authenticate: () => ({ ok:true, principal:{ authenticated:true, subject:'u1' } }) },
  commands: {
    create: async () => ({ ok:true, schedule:{ scheduleId:'schedule_1' } }),
    list: async () => ({ ok:true, schedules:[] }),
    update: async (input) => { calls.push(input); return { ok:true, schedule:{ scheduleId:input.scheduleId, status:'scheduled' } }; },
    cancel: async () => ({ ok:true, schedule:{ scheduleId:'schedule_1', status:'cancelled' } })
  },
  readJson: async (request) => request.body
});
const response = await api.handle({ method:'PATCH', pathname:'/api/schedules/schedule_1', headers:{}, request:{ body:{ task:'güncel' } } });
assert.equal(response.status, 200);
assert.equal(calls[0].scheduleId, 'schedule_1');
assert.deepEqual(calls[0].input, { task:'güncel' });
const method = await api.handle({ method:'PUT', pathname:'/api/schedules/schedule_1', headers:{}, request:{ body:{} } });
assert.equal(method.status, 405);
assert.match(method.headers.Allow, /PATCH/);
const rootMethod = await api.handle({ method:'PATCH', pathname:'/api/schedules', headers:{}, request:{ body:{} } });
assert.equal(rootMethod.status, 405);
console.log('scheduled task patch HTTP contracts ok');
