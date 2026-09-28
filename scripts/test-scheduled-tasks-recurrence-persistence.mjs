import assert from 'node:assert/strict';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';

let saved = null;
const adapter = {
  async load(){ return saved; },
  async save(value){ saved = value; }
};
const create = (await import('../lib/task-schedule-store.mjs')).createTaskScheduleStore;
const persistence = createTaskSchedulePersistence({
  adapter,
  storeOptions:{ now:()=>new Date('2026-09-28T09:00:00Z') },
  createStore:create
});
await persistence.open();
await persistence.add({
  traceId:'trace-2',ownerId:'user-2',agentId:'writer',task:'Haftalık plan',
  runAt:'2026-09-28T09:00:00Z',maxAttempts:1,
  recurrence:{frequency:'weekly',interval:1,daysOfWeek:[1,5]}
});
const snapshot = persistence.snapshot();
assert.equal(snapshot.entries[0].recurrence.frequency,'weekly');
assert.deepEqual(snapshot.entries[0].recurrence.daysOfWeek,[1,5]);
assert.equal(snapshot.entries[0].history.length,0);
assert.equal(saved.schemaVersion,1);

const reloadAdapter = {
  async load(){ return saved; },
  async save(value){ saved=value; }
};
const restored = createTaskSchedulePersistence({adapter:reloadAdapter,storeOptions:{now:()=>new Date('2026-09-28T09:00:00Z')},createStore:create});
await restored.open();
const roundTrip = restored.snapshot().entries[0];
assert.equal(roundTrip.recurrence.frequency,'weekly');
assert.deepEqual(roundTrip.recurrence.daysOfWeek,[1,5]);
console.log('scheduled recurrence persistence: ok');
