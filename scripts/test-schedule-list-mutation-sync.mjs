import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const listPath = fileURLToPath(new URL('../public/schedule-list.js', import.meta.url));
const createPath = fileURLToPath(new URL('../public/schedule-create.js', import.meta.url));
const cancelPath = fileURLToPath(new URL('../public/schedule-cancel.js', import.meta.url));
const [list, create, cancel] = await Promise.all([
  readFile(listPath, 'utf8'),
  readFile(createPath, 'utf8'),
  readFile(cancelPath, 'utf8')
]);

assert.match(create, /const CREATED_EVENT = 'hafize:schedule-created'/);
assert.match(cancel, /const CANCELLED_EVENT = 'hafize:schedule-cancelled'/);
assert.match(list, /const CREATED_EVENT = 'hafize:schedule-created'/);
assert.match(list, /const CANCELLED_EVENT = 'hafize:schedule-cancelled'/);
assert.match(list, /root\.addEventListener\?\.\(CREATED_EVENT, onScheduleMutation\)/);
assert.match(list, /root\.addEventListener\?\.\(CANCELLED_EVENT, onScheduleMutation\)/);
assert.match(list, /if \(busy\) \{ pendingMutationRefresh = true; return; \}/);
assert.match(list, /if \(pendingMutationRefresh\)/);
assert.match(list, /refresh\(\{ reason: 'mutation' \}\)/);
assert.match(list, /root\.removeEventListener\?\.\(CREATED_EVENT, onScheduleMutation\)/);
assert.match(list, /root\.removeEventListener\?\.\(CANCELLED_EVENT, onScheduleMutation\)/);
assert.match(list, /pendingMutationRefresh = false/);

const createdDispatches = create.split('dispatchEvent').length - 1;
const cancelledDispatches = cancel.split('dispatchEvent').length - 1;
assert.equal(createdDispatches >= 1, true, 'successful creation must emit mutation event');
assert.equal(cancelledDispatches >= 1, true, 'successful cancellation must emit mutation event');

console.log('schedule list mutation sync tests passed');
