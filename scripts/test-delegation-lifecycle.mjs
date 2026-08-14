import assert from 'node:assert/strict';
import { createDelegationLifecycle } from '../lib/delegation-lifecycle.mjs';

const lifecycle = createDelegationLifecycle({ maxParallelAgents: 2 });
const first = lifecycle.acquire('task_1');
const second = lifecycle.acquire('task_2');
assert.equal(first.ok, true);
assert.equal(second.ok, true);
assert.equal(lifecycle.snapshot().active, 2);
assert.deepEqual(lifecycle.acquire('task_3'), { ok: false, error: 'DELEGATION_PARALLEL_LIMIT_EXCEEDED' });
assert.equal(first.release(), true);
const third = lifecycle.acquire('task_3');
assert.equal(third.ok, true);
assert.equal(lifecycle.cancel('task_3'), true);
assert.equal(third.signal.aborted, true);
assert.equal(third.signal.reason, 'DELEGATION_CANCELLED');
third.release();
second.release();
assert.equal(lifecycle.snapshot().active, 0);

const parent = new AbortController();
const parentLifecycle = createDelegationLifecycle({ maxParallelAgents: 1, parentSignal: parent.signal });
const parentTask = parentLifecycle.acquire('task_parent');
parent.abort('request_closed');
assert.equal(parentTask.signal.aborted, true);
assert.equal(parentTask.signal.reason, 'request_closed');
parentTask.release();

const local = new AbortController();
const localLifecycle = createDelegationLifecycle({ maxParallelAgents: 1 });
const localTask = localLifecycle.acquire('task_local', { signal: local.signal });
local.abort('caller_cancelled');
assert.equal(localTask.signal.aborted, true);
assert.equal(localTask.signal.reason, 'caller_cancelled');
localTask.release();

const closed = createDelegationLifecycle({ maxParallelAgents: 3 });
const a = closed.acquire('a');
const b = closed.acquire('b');
assert.equal(closed.cancelAll('shutdown'), 2);
assert.equal(a.signal.aborted, true);
assert.equal(b.signal.aborted, true);
assert.deepEqual(closed.acquire('c'), { ok: false, error: 'DELEGATION_LIFECYCLE_CLOSED' });
a.release();
b.release();

assert.throws(() => createDelegationLifecycle({ parentSignal: {} }), /parentSignal/);
assert.throws(() => lifecycle.acquire(''), /taskId/);
assert.throws(() => lifecycle.acquire('x', { signal: {} }), /signal/);
console.log('delegation lifecycle tests passed');
