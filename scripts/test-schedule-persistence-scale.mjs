import assert from 'node:assert/strict';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';

const saved = [];
const adapter = {
  async load() { return saved.length ? structuredClone(saved.at(-1)) : null; },
  async save(value) { saved.push(structuredClone(value)); }
};
const store = createTaskSchedulePersistence({ adapter, storeOptions: { now: () => new Date('2026-09-16T06:00:00.000Z') } });
await store.open();
for (let index = 0; index < 260; index += 1) {
  await store.add({ traceId: `trace-${index}`, agentId: 'hafize-general', task: `task ${index}`, runAt: '2026-09-17T06:00:00.000Z', ownerId: index % 2 ? 'bob' : 'alice' });
}

assert.equal(store.snapshot().entries.length, 260);
const page = store.list({ ownerId: 'alice', limit: 25, sort: 'created-desc' });
assert.equal(page.entries.length, 25);
assert.equal(page.total, 130);
assert.ok(page.nextCursor);

const firstIds = page.entries.map((entry) => entry.scheduleId);
const second = store.list({ ownerId: 'alice', limit: 25, sort: 'created-desc', cursor: page.nextCursor });
assert.equal(second.entries.length, 25);
assert.equal(second.entries.some((entry) => firstIds.includes(entry.scheduleId)), false);

const selected = second.entries.slice(0, 3).map((entry) => entry.scheduleId);
const cancelled = await store.cancelMany(selected, 'alice');
assert.equal(cancelled.length, 3);
assert.equal(store.snapshot().entries.filter((entry) => entry.status === 'cancelled').length, 3);
assert.equal(saved.length, 263);

const reopened = createTaskSchedulePersistence({ adapter, storeOptions: { now: () => new Date('2026-09-16T06:00:00.000Z') } });
await reopened.open();
assert.equal(reopened.snapshot().entries.length, 260);
assert.equal(reopened.snapshot().entries.filter((entry) => entry.status === 'cancelled').length, 3);

const badAdapter = {
  async load() { return { schemaVersion: 1, snapshot: { entries: [] }, unexpected: true }; },
  async save() {}
};
const invalid = createTaskSchedulePersistence({ adapter: badAdapter });
await assert.rejects(() => invalid.open(), /SCHEDULE_PERSISTENCE_INVALID_SNAPSHOT/);

console.log('schedule persistence scale tests passed');
