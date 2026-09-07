import assert from 'node:assert/strict';
import {
  assertCalendarWriteApproved,
  calendarWriteApproval,
  normalizeCalendarItems,
  normalizeCalendarRead
} from '../lib/calendar-contract.mjs';
import { createCalendarReadRuntime } from '../lib/calendar-read-runtime.mjs';

const read = normalizeCalendarRead({ ownerId: 'u1', query: { from: '2026-09-01', to: '2026-09-30', kind: 'event', query: 'toplantı' } });
assert.equal(read.ownerId, 'u1');
assert.equal(read.query.from, '2026-09-01');
assert.equal(read.query.kind, 'event');
assert.throws(() => normalizeCalendarRead({ ownerId: 'u1', query: { from: '2026-09-30', to: '2026-09-01' } }), /INVALID_CALENDAR_RANGE/);
assert.throws(() => normalizeCalendarRead({ ownerId: 'u1', query: { from: '2026-02-30' } }), /INVALID_CALENDAR_FROM/);

const items = normalizeCalendarItems({ ownerId: 'u1', items: [
  { id: 'event-1', kind: 'event', title: 'Ürün toplantısı', description: 'Planlama', date: '2026-09-10', startTime: '10:00', endTime: '11:00', timezone: 'Europe/Istanbul' },
  { id: 'rem-1', kind: 'reminder', title: 'Fatura kontrolü', date: '2026-09-11' }
] });
assert.equal(items.items.length, 2);
assert.equal(items.items[0].kind, 'event');
assert.equal(items.items[1].kind, 'reminder');
assert.throws(() => normalizeCalendarItems({ ownerId: 'u1', items: [{ kind: 'evil', title: 'x', date: '2026-09-10' }] }), /INVALID_CALENDAR_KIND/);

assert.deepEqual(calendarWriteApproval('calendar.create'), { action: 'calendar.create', requiresApproval: true });
assert.throws(() => assertCalendarWriteApproved({ action: 'calendar.delete' }), /CALENDAR_APPROVAL_REQUIRED:calendar.delete/);
assert.deepEqual(assertCalendarWriteApproved({ action: 'calendar.delete', approvalGranted: true }), { action: 'calendar.delete', requiresApproval: true, approved: true });
assert.throws(() => calendarWriteApproval('external.write'), /INVALID_CALENDAR_ACTION/);

const runtime = createCalendarReadRuntime({
  ownerId: 'u1',
  source: {
    async read() {
      return items.items;
    }
  }
});
assert.equal(runtime.size(), 0);
await runtime.refresh();
assert.equal(runtime.size(), 2);
assert.equal(runtime.list({ kind: 'reminder' }).length, 1);
assert.equal(runtime.list({ from: '2026-09-10', to: '2026-09-10' }).length, 1);
assert.equal(runtime.list({ query: 'fatura' }).length, 1);
assert.throws(() => createCalendarReadRuntime({ ownerId: '', source: { read: async () => [] } }), /INVALID_CALENDAR_RUNTIME_OWNER/);
assert.throws(() => createCalendarReadRuntime({ ownerId: 'u1', source: {} }), /INVALID_CALENDAR_RUNTIME_SOURCE/);

console.log('calendar contract tests passed');
