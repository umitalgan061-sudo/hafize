import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const filters = require('../public/schedule-list-filter.js');

assert.equal(filters.MAX_QUERY_CHARS, 120);
assert.equal(filters.SCOPE_EVENT, 'hafize:schedule-scope-changed');
assert.deepEqual(Object.keys(filters.FILTERS), ['all', 'active', 'history', 'failed']);
assert.deepEqual([...filters.FILTERS.active.statuses], ['scheduled', 'running']);
assert.deepEqual([...filters.FILTERS.history.statuses], ['completed', 'failed', 'cancelled']);
assert.deepEqual([...filters.FILTERS.failed.statuses], ['failed']);

assert.equal(filters.safeQuery('  deneme   görev  '), 'deneme görev');
assert.equal(filters.safeQuery('a\u0000b\n c'), 'a b c');
assert.equal(filters.safeQuery(null), '');
assert.equal(filters.safeQuery('x'.repeat(121)).length, 120);
assert.equal(filters.fold('İSTANBUL'), 'istanbul');
assert.equal(filters.normalizeFilter('active'), 'active');
assert.equal(filters.normalizeFilter('unknown'), 'all');
assert.equal(filters.normalizeFilter(null), 'all');

const dispatched = [];
const eventRoot = {
  CustomEvent: class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init.detail; }
  },
  dispatchEvent(event) { dispatched.push(event); return true; }
};
assert.equal(filters.dispatchScope(eventRoot, 'active'), true);
assert.equal(dispatched[0].type, filters.SCOPE_EVENT);
assert.deepEqual(dispatched[0].detail, { scope: 'active' });
assert.equal(filters.dispatchScope(eventRoot, 'invalid'), true);
assert.deepEqual(dispatched[1].detail, { scope: 'all' });
assert.equal(filters.dispatchScope(null, 'active'), false);

function article({ status, agent = 'minimal-engineer', task = 'Günlük raporu hazırla' }) {
  const nodes = new Map([
    ['.schedule-list-agent', { textContent: agent }],
    ['.schedule-list-task', { textContent: task }]
  ]);
  return {
    dataset: { state: status },
    querySelector(selector) { return nodes.get(selector) || null; }
  };
}

const scheduled = filters.readItem(article({ status: 'scheduled', task: 'Ankara raporu' }));
const running = filters.readItem(article({ status: 'running', task: 'NVIDIA kontrolü' }));
const completed = filters.readItem(article({ status: 'completed', task: 'Eski rapor' }));
const failed = filters.readItem(article({ status: 'failed', task: 'Canva bağlantısı' }));
const cancelled = filters.readItem(article({ status: 'cancelled', task: 'Gmail özeti' }));

assert.ok(scheduled);
assert.ok(running);
assert.ok(completed);
assert.ok(failed);
assert.ok(cancelled);
assert.equal(filters.readItem(article({ status: 'mystery' })), null);
assert.equal(filters.readItem(null), null);

assert.equal(filters.matchesItem(scheduled, { filter: 'all' }), true);
assert.equal(filters.matchesItem(scheduled, { filter: 'active' }), true);
assert.equal(filters.matchesItem(running, { filter: 'active' }), true);
assert.equal(filters.matchesItem(completed, { filter: 'active' }), false);
assert.equal(filters.matchesItem(completed, { filter: 'history' }), true);
assert.equal(filters.matchesItem(cancelled, { filter: 'history' }), true);
assert.equal(filters.matchesItem(failed, { filter: 'failed' }), true);
assert.equal(filters.matchesItem(completed, { filter: 'failed' }), false);
assert.equal(filters.matchesItem(scheduled, { filter: 'invalid' }), true);
assert.equal(filters.matchesItem(scheduled, { query: 'ankara' }), true);
assert.equal(filters.matchesItem(scheduled, { query: 'ANKARA' }), true);
assert.equal(filters.matchesItem(scheduled, { query: 'minimal' }), true);
assert.equal(filters.matchesItem(scheduled, { query: 'giresun' }), false);
assert.equal(filters.matchesItem(null, { filter: 'all' }), false);

const counts = filters.countByFilter([scheduled, running, completed, failed, cancelled, null]);
assert.deepEqual(counts, { all: 5, active: 2, history: 3, failed: 1 });
assert.equal(Object.isFrozen(counts), true);
assert.equal(Object.isFrozen(filters.FILTERS), true);
assert.equal(Object.isFrozen(filters.FILTERS.active.statuses), true);

console.log('schedule list filter helper tests passed');