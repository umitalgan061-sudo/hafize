import assert from 'node:assert/strict';
import { createAgentLifecycle } from '../lib/agent-lifecycle.mjs';

// Executors are dispatched on a later microtask, so a run body only begins
// after the event loop is flushed at least once.
const flush = () => new Promise((resolve) => { setImmediate(resolve); });

const lifecycle = createAgentLifecycle({ maxConcurrent: 2, inboxLimit: 2 });
const parent = new AbortController();
let resolveFirst;
let executedAfterParentAbort = false;
const first = lifecycle.start({
  runId: 'child-1',
  parentSignal: parent.signal,
  execute: async ({ signal }) => {
    assert.equal(signal.aborted, false);
    await new Promise((resolve) => { resolveFirst = resolve; });
    return 'done';
  }
});
await flush();
assert.equal(typeof resolveFirst, 'function');
assert.equal(first.snapshot().state, 'running');
assert.equal(lifecycle.liveCount(), 1);
assert.equal(lifecycle.sendMessage('child-1', 'hello').content, 'hello');
assert.equal(lifecycle.sendMessage('child-1', 'again').content, 'again');
assert.throws(() => lifecycle.sendMessage('child-1', 'overflow'), /AGENT_INBOX_FULL/);
const second = lifecycle.start({ runId: 'child-2', execute: async () => 'second' });
assert.equal(lifecycle.liveCount(), 2);
assert.throws(() => lifecycle.start({ runId: 'child-3', execute: async () => 'nope' }), /AGENT_CONCURRENCY_EXCEEDED/);
parent.abort();
assert.equal(lifecycle.get('child-1').state, 'cancelled');
assert.equal(lifecycle.get('child-1').error, 'PARENT_ABORTED');
resolveFirst();
await first.promise;
await second.promise;
assert.equal(lifecycle.get('child-1').state, 'cancelled');
assert.equal(lifecycle.get('child-2').state, 'completed');
assert.equal(lifecycle.liveCount(), 0);
assert.throws(() => lifecycle.sendMessage('child-2', 'late'), /AGENT_RUN_NOT_ACCEPTING_MESSAGES/);
assert.throws(() => lifecycle.sendMessage('missing', 'x'), /AGENT_RUN_NOT_ACCEPTING_MESSAGES/);
const alreadyAborted = new AbortController();
alreadyAborted.abort();
lifecycle.start({ runId: 'pre-cancelled', parentSignal: alreadyAborted.signal, execute: async () => { executedAfterParentAbort = true; } });
assert.equal(executedAfterParentAbort, false);
assert.equal(lifecycle.get('pre-cancelled').state, 'cancelled');
assert.throws(() => createAgentLifecycle({ maxConcurrent: 0 }), /INVALID_AGENT_CONCURRENCY_LIMIT/);
assert.throws(() => createAgentLifecycle({ maxConcurrent: 9 }), /INVALID_AGENT_CONCURRENCY_LIMIT/);
assert.throws(() => createAgentLifecycle({ inboxLimit: 0 }), /INVALID_AGENT_INBOX_LIMIT/);
assert.throws(() => lifecycle.start({ runId: 'child-2', execute: async () => null }), /AGENT_RUN_ALREADY_EXISTS/);
assert.throws(() => lifecycle.start({ runId: 'bad', execute: null }), /INVALID_AGENT_EXECUTOR/);
console.log('agent lifecycle tests passed');
