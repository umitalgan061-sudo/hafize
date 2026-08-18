import assert from 'node:assert/strict';
import { createScheduledNvidiaCompletion } from '../lib/scheduled-nvidia-completion.mjs';

function waitForAbort(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason || new Error('aborted'));
      return;
    }
    signal.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true });
  });
}

const caller = new AbortController();
let providerSignal = null;
const completion = createScheduledNvidiaCompletion({
  timeoutMs: 60_000,
  complete: async (_payload, signal) => {
    providerSignal = signal;
    return waitForAbort(signal);
  }
});

const pending = completion({ model: 'nvidia/test' }, caller.signal);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(providerSignal?.aborted, false);
caller.abort(new Error('lease lost'));
await assert.rejects(
  () => pending,
  (error) => error?.code === 'SCHEDULE_AGENT_RUN_CANCELLED'
);
assert.equal(providerSignal.aborted, true);

let disposed = 0;
let runtimeSignal = null;
const timeoutCompletion = createScheduledNvidiaCompletion({
  timeoutMs: 10_000,
  createAbortRuntime({ signal }) {
    const controller = new AbortController();
    runtimeSignal = controller.signal;
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    queueMicrotask(() => controller.abort(new Error('timeout')));
    return {
      signal: controller.signal,
      dispose() { disposed += 1; },
      isTimedOut() { return true; }
    };
  },
  complete: async (_payload, signal) => waitForAbort(signal)
});
await assert.rejects(
  () => timeoutCompletion({}),
  (error) => error?.code === 'SCHEDULE_AGENT_RUN_TIMEOUT'
);
assert.equal(runtimeSignal.aborted, true);
assert.equal(disposed, 1);

process.stdout.write('scheduled NVIDIA cancellation propagation passed\n');
