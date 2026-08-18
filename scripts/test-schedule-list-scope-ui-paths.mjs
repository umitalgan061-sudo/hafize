import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const filters = require('../public/schedule-list-filter.js');
const source = await readFile(new URL('../public/schedule-list.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, {
  module,
  URLSearchParams,
  Intl,
  Date,
  Set,
  Map,
  Object,
  Number,
  String,
  Array,
  console
}, { filename: 'schedule-list.js' });
const list = module.exports;

assert.equal(list.SCOPE_EVENT, filters.SCOPE_EVENT);
assert.deepEqual([...list.SCOPES], ['all', 'active', 'history', 'failed']);
for (const scope of ['all', 'active', 'history', 'failed']) {
  assert.equal(list.normalizeScope(scope), scope);
  const path = list.createListPath({ scope });
  assert.equal(path, `/api/schedules?limit=100&view=summary&scope=${scope}`);
}
for (const invalid of ['', 'FAILED', 'active,failed', null, {}, []]) {
  assert.equal(list.normalizeScope(invalid), 'all');
}

const snapshot = 'S'.repeat(43);
for (const scope of ['active', 'history', 'failed']) {
  const path = list.createListPath({ offset: 200, snapshot, scope });
  assert.equal(path, `/api/schedules?limit=100&view=summary&scope=${scope}&offset=200&snapshot=${snapshot}`);
}
assert.throws(() => list.createListPath({ offset: 200, scope: 'failed' }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);
assert.throws(() => list.createListPath({ offset: 0, snapshot, scope: 'failed' }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);

const events = [];
const root = {
  CustomEvent: class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init.detail; }
  },
  dispatchEvent(event) {
    events.push(event);
    return true;
  }
};
assert.equal(filters.dispatchScope(root, 'failed'), true);
assert.equal(events.length, 1);
assert.equal(events[0].type, filters.SCOPE_EVENT);
assert.deepEqual(events[0].detail, { scope: 'failed' });
assert.equal(Object.isFrozen(events[0].detail), true);
assert.equal(filters.dispatchScope(root, 'bogus'), true);
assert.deepEqual(events[1].detail, { scope: 'all' });
assert.equal(filters.dispatchScope({}, 'active'), false);

const filterSource = await readFile(new URL('../public/schedule-list-filter.js', import.meta.url), 'utf8');
assert.match(filterSource, /dispatchScope\(root, filter\)/);
assert.match(filterSource, /card\.dataset\?\.scope/);
assert.match(filterSource, /refs\.count\.hidden = serverScope !== 'all'/);
assert.match(source, /root\.addEventListener\?\.\(SCOPE_EVENT, onScope\)/);
assert.match(source, /root\.removeEventListener\?\.\(SCOPE_EVENT, onScope\)/);
assert.match(source, /requestScope !== currentScope/);
assert.match(source, /pendingScope/);

console.log('schedule list scope UI path tests passed');
