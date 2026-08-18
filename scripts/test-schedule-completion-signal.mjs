import assert from 'node:assert/strict';
import {
  SCHEDULE_COMPLETION_SIGNAL_LIMITS,
  createScheduleCompletionSignal,
  runWithScheduleCompletionSignal
} from '../lib/schedule-completion-signal.mjs';

assert.deepEqual(SCHEDULE_COMPLETION_SIGNAL_LIMITS, {
  defaultTimeoutMs: 120_000,
  minTimeoutMs: 1_000,
  maxTimeoutMs: 300_000
});

{
  const parent = new AbortController();
  const context = createScheduleCompletionSignal({ parentSignal: parent.signal, timeoutMs: 5_000 });
  assert.equal(context.signal.aborted, false);
  assert.equal(context.cause(), null);
  parent.abort('lease_lost');
  assert.equal(context.signal.aborted, true);
  assert.equal(context.signal.reason, 'caller');
  assert.equal(context.cause(), 'caller');
  assert.equal(context.dispose(), true);
  assert.equal(context.dispose(), false);
}

{
  const parent = new AbortController();
  parent.abort('already_done');
  const context = createScheduleCompletionSignal({ parentSignal: parent.signal, timeoutMs: 5_000 });
  assert.equal(context.signal.aborted, true);
  assert.equal(context.cause(), 'caller');
  assert.equal(context.dispose(), true);
}

{
  let observedSignal = null;
  const result = await runWithScheduleCompletionSignal({
    timeoutMs: 5_000,
    async run(signal, context) {
      observedSignal = signal;
      assert.equal(context.cause(), null);
      return { ok: true };
    }
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(observedSignal.aborted, false);
}

{
  const parent = new AbortController();
  let operationSettled = false;
  const pending = runWithScheduleCompletionSignal({
    parentSignal: parent.signal,
    timeoutMs: 5_000,
    run(signal) {
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          operationSettled = true;
          const error = new Error('FETCH_ABORTED');
          error.name = 'AbortError';
          reject(error);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        setTimeout(() => resolve('late'), 2_000).unref?.();
      });
    }
  });
  parent.abort('worker_cancelled');
  await assert.rejects(pending, (error) => error?.name === 'AbortError' && error?.message === 'FETCH_ABORTED');
  assert.equal(operationSettled, true);
}

console.log('schedule completion signal lifecycle: ok');
