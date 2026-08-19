import assert from 'node:assert/strict';
import {
  createBoundedAbortRuntime,
  runWithBoundedAbort,
  normalizeTimeoutMs,
  validSignal
} from '../lib/bounded-abort-runtime.mjs';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

assert.equal(validSignal(null), true);
assert.equal(validSignal(new AbortController().signal), true);
assert.equal(validSignal({ aborted: false }), false);
assert.equal(normalizeTimeoutMs(1000), 1000);
assert.throws(() => normalizeTimeoutMs(0), /INVALID_BOUNDED_ABORT_TIMEOUT/);
assert.throws(() => normalizeTimeoutMs(300001), /INVALID_BOUNDED_ABORT_TIMEOUT/);
assert.throws(
  () => createBoundedAbortRuntime({ signal: { aborted: false }, timeoutMs: 1000 }),
  /INVALID_BOUNDED_ABORT_SIGNAL/
);

{
  const parent = new AbortController();
  const runtime = createBoundedAbortRuntime({ signal: parent.signal, timeoutMs: 1000 });
  assert.equal(runtime.signal.aborted, false);
  const reason = new Error('caller-cancelled');
  parent.abort(reason);
  assert.equal(runtime.signal.aborted, true);
  assert.equal(runtime.signal.reason, reason);
  assert.equal(runtime.isTimedOut(), false);
  assert.equal(runtime.dispose(), true);
  assert.equal(runtime.dispose(), false);
}

{
  const parent = new AbortController();
  parent.abort(new Error('already-aborted'));
  const runtime = createBoundedAbortRuntime({ signal: parent.signal, timeoutMs: 1000 });
  assert.equal(runtime.signal.aborted, true);
  assert.equal(runtime.signal.reason?.message, 'already-aborted');
  assert.equal(runtime.isTimedOut(), false);
  runtime.dispose();
}

{
  const runtime = createBoundedAbortRuntime({ timeoutMs: 1000 });
  const reason = new Error('owned-cancel');
  assert.equal(runtime.abort(reason), true);
  assert.equal(runtime.signal.aborted, true);
  assert.equal(runtime.signal.reason, reason);
  assert.equal(runtime.isTimedOut(), false, 'explicit cancellation must not be reported as a timeout');
  assert.equal(runtime.abort(new Error('later')), false, 'owned signal may only be aborted once');
  assert.equal(runtime.dispose(), true);
  assert.equal(runtime.abort(new Error('after-dispose')), false, 'disposed runtimes reject late cancellation');
}

{
  const runtime = createBoundedAbortRuntime({ timeoutMs: 25 });
  await delay(60);
  assert.equal(runtime.signal.aborted, true);
  assert.equal(runtime.isTimedOut(), true);
  assert.equal(runtime.signal.reason?.code, 'BOUNDED_ABORT_TIMEOUT');
  runtime.dispose();
}

{
  const runtime = createBoundedAbortRuntime({ timeoutMs: 25 });
  assert.equal(runtime.dispose(), true);
  await delay(60);
  assert.equal(runtime.signal.aborted, false);
  assert.equal(runtime.isTimedOut(), false);
}

{
  const parent = new AbortController();
  let observedSignal = null;
  const value = await runWithBoundedAbort(async (signal) => {
    observedSignal = signal;
    assert.equal(signal.aborted, false);
    return 'ok';
  }, { signal: parent.signal, timeoutMs: 1000 });
  assert.equal(value, 'ok');
  assert.ok(observedSignal);
  await delay(10);
  assert.equal(observedSignal.aborted, false);
}

{
  const parent = new AbortController();
  let observed = null;
  const pending = runWithBoundedAbort(async (signal) => {
    observed = signal;
    await new Promise((resolve, reject) => {
      const onAbort = () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    });
  }, { signal: parent.signal, timeoutMs: 1000 });
  parent.abort(new Error('stop-now'));
  await assert.rejects(pending, (error) => error?.name === 'AbortError');
  assert.equal(observed.aborted, true);
  assert.equal(observed.reason?.message, 'stop-now');
}

{
  let observed = null;
  const pending = runWithBoundedAbort(async (signal) => {
    observed = signal;
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  }, { timeoutMs: 25 });
  await assert.rejects(pending, (error) => error?.code === 'BOUNDED_ABORT_TIMEOUT');
  assert.equal(observed.aborted, true);
}

assert.throws(
  () => runWithBoundedAbort(null, { timeoutMs: 1000 }),
  /INVALID_BOUNDED_ABORT_OPERATION/
);

process.stdout.write('bounded abort runtime tests passed\n');
