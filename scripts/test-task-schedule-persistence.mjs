import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';

let clock = new Date('2026-08-12T11:00:00.000Z');
const now = () => new Date(clock);
let durable = null;
let saveInFlight = 0;
let maxSaveInFlight = 0;
let failSave = false;

const adapter = {
  async load() {
    return durable == null ? null : structuredClone(durable);
  },
  async save(envelope) {
    saveInFlight += 1;
    maxSaveInFlight = Math.max(maxSaveInFlight, saveInFlight);
    await Promise.resolve();
    try {
      if (failSave) throw new Error('provider secret detail');
      durable = structuredClone(envelope);
    } finally {
      saveInFlight -= 1;
    }
  }
};

const persistence = createTaskSchedulePersistence({ adapter, storeOptions: { now } });
assert.throws(() => persistence.snapshot(), /SCHEDULE_PERSISTENCE_NOT_OPEN/);
await persistence.open();
assert.deepEqual(persistence.snapshot(), { entries: [] });

const first = await persistence.add({
  ownerId: 'user-1',
  traceId: 'trace-1',
  agentId: 'hafize-general',
  task: 'Sabah özetini hazırla.',
  runAt: '2026-08-12T12:00:00.000Z',
  maxAttempts: 2
});
assert.equal(first.scheduleId, 'schedule_1');
assert.equal(durable.schemaVersion, 1);
assert.equal(durable.snapshot.entries[0].ownerId, 'user-1');

const leaked = persistence.snapshot();
leaked.entries[0].task = 'outside mutation';
assert.equal(persistence.read(first.scheduleId).task, 'Sabah özetini hazırla.');

const restarted = createTaskSchedulePersistence({ adapter, storeOptions: { now } });
await Promise.all([restarted.open(), restarted.open()]);
assert.equal(restarted.read(first.scheduleId).traceId, 'trace-1');
const second = await restarted.add({
  ownerId: 'user-1',
  traceId: 'trace-2',
  agentId: 'hafize-general',
  task: 'İkinci görev',
  runAt: '2026-08-12T13:00:00.000Z'
});
assert.equal(second.scheduleId, 'schedule_2');

const concurrent = await Promise.all([
  restarted.add({ ownerId: 'user-1', traceId: 'trace-3', agentId: 'hafize-general', task: 'Üç', runAt: '2026-08-12T14:00:00.000Z' }),
  restarted.add({ ownerId: 'user-1', traceId: 'trace-4', agentId: 'hafize-general', task: 'Dört', runAt: '2026-08-12T15:00:00.000Z' })
]);
assert.deepEqual(concurrent.map((item) => item.scheduleId), ['schedule_3', 'schedule_4']);
assert.equal(maxSaveInFlight, 1);

const beforeFailure = restarted.snapshot();
failSave = true;
await assert.rejects(
  restarted.add({ ownerId: 'user-1', traceId: 'trace-fail', agentId: 'hafize-general', task: 'Kaydedilmemeli', runAt: '2026-08-12T16:00:00.000Z' }),
  /SCHEDULE_PERSISTENCE_SAVE_FAILED/
);
assert.deepEqual(restarted.snapshot(), beforeFailure);
assert.equal(JSON.stringify(restarted.snapshot()).includes('provider secret detail'), false);
failSave = false;
const afterFailure = await restarted.add({
  ownerId: 'user-1',
  traceId: 'trace-5',
  agentId: 'hafize-general',
  task: 'Beş',
  runAt: '2026-08-12T16:00:00.000Z'
});
assert.equal(afterFailure.scheduleId, 'schedule_5');

const runningStore = createTaskScheduleStore({ now });
runningStore.add({
  traceId: 'trace-running',
  agentId: 'hafize-general',
  task: 'running',
  runAt: '2026-08-12T10:00:00.000Z',
  maxAttempts: 2
});
runningStore.claimDue();
durable = { schemaVersion: 1, snapshot: runningStore.snapshot() };
const recovered = createTaskSchedulePersistence({ adapter, storeOptions: { now } });
await recovered.open();
assert.equal(recovered.read('schedule_1').status, 'running');
assert.equal(recovered.read('schedule_1').attempts, 1);

const invalidEnvelopes = [
  { schemaVersion: 2, snapshot: { entries: [] } },
  { schemaVersion: 1, snapshot: { entries: [] }, token: 'must-not-load' },
  { schemaVersion: 1, snapshot: { entries: [{ scheduleId: 'schedule_1', token: 'must-not-load' }] } }
];
for (const envelope of invalidEnvelopes) {
  await assert.rejects(
    createTaskSchedulePersistence({
      adapter: { load: async () => envelope, save: async () => {} },
      storeOptions: { now }
    }).open(),
    /SCHEDULE_PERSISTENCE_INVALID_SNAPSHOT/
  );
}

await assert.rejects(
  createTaskSchedulePersistence({
    adapter: { load: async () => { throw new Error('secret'); }, save: async () => {} }
  }).open(),
  /SCHEDULE_PERSISTENCE_LOAD_FAILED/
);

assert.throws(
  () => createTaskScheduleStore({
    initialSnapshot: {
      entries: [{
        scheduleId: 'schedule_999999999999999999999999',
        traceId: 't',
        ownerId: null,
        agentId: 'a',
        task: 'x',
        runAt: '2026-08-12T12:00:00.000Z',
        status: 'scheduled',
        attempts: 0,
        maxAttempts: 1,
        lastError: null,
        createdAt: '2026-08-12T11:00:00.000Z',
        updatedAt: null
      }]
    }
  }),
  /INVALID_TASK_SCHEDULE_SNAPSHOT:scheduleId/
);

console.log('task schedule persistence tests passed');
