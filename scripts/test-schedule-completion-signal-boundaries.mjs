import assert from 'node:assert/strict';
import {
  createScheduleCompletionSignal,
  normalizeTimeoutMs,
  runWithScheduleCompletionSignal,
  validSignal
} from '../lib/schedule-completion-signal.mjs';

for (const value of [1_000, 10_000, 120_000, 300_000]) {
  assert.equal(normalizeTimeoutMs(value), value);
}
for (const value of [0, 999, 300_001, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, '1000', null]) {
  if (value === null) {
    assert.equal(normalizeTimeoutMs(), 120_000);
    continue;
  }
  assert.throws(() => normalizeTimeoutMs(value), /INVALID_SCHEDULE_COMPLETION_SIGNAL:timeoutMs/);
}

assert.equal(validSignal(null), true);
assert.equal(validSignal(new AbortController().signal), true);
for (const value of [{}, { aborted: false }, { aborted: false, addEventListener() {} }, [], 'signal']) {
  assert.equal(validSignal(value), false);
}
assert.throws(
  () => createScheduleCompletionSignal({ parentSignal: { aborted: false }, timeoutMs: 5_000 }),
  /INVALID_SCHEDULE_COMPLETION_SIGNAL:parentSignal/
);
await assert.rejects(
  runWithScheduleCompletionSignal({ timeoutMs: 5_000 }),
  /INVALID_SCHEDULE_COMPLETION_SIGNAL:run/
);

{
  let aborted = false;
  const started = Date.now();
  await assert.rejects(
    runWithScheduleCompletionSignal({
      timeoutMs: 1_000,
      run(signal) {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            const error = new Error(String(signal.reason));
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
          setTimeout(() => resolve('unexpected'), 5_000).unref?.();
        });
      }
    }),
    (error) => error?.name === 'AbortError' && error?.message === 'timeout'
  );
  assert.equal(aborted, true);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 900 && elapsed < 3_000, `timeout elapsed=${elapsed}`);
}

{
  const parent = new AbortController();
  let abortCount = 0;
  const pending = runWithScheduleCompletionSignal({
    parentSignal: parent.signal,
    timeoutMs: 1_000,
    run(signal) {
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          abortCount += 1;
          reject(Object.assign(new Error('ABORTED'), { name: 'AbortError' }));
        }, { once: true });
        setTimeout(resolve, 5_000).unref?.();
      });
    }
  });
  parent.abort('lease_lost');
  await assert.rejects(pending, /ABORTED/);
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  assert.equal(abortCount, 1, 'caller abort must win and timeout must be cleaned');
}

console.log('schedule completion signal boundaries: ok');
