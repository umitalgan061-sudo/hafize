import assert from 'node:assert/strict';
import { createScheduledNvidiaCompletion, normalizeTimeoutMs } from '../lib/scheduled-nvidia-completion.mjs';

assert.equal(normalizeTimeoutMs(10_000), 10_000);
assert.equal(normalizeTimeoutMs(300_000), 300_000);
for (const value of [undefined, null, 0, 9_999, 300_001, 12.5, '120000']) {
  assert.throws(() => normalizeTimeoutMs(value), /INVALID_SCHEDULE_NVIDIA_TIMEOUT/);
}

let receivedSignal = null;
let calls = 0;
const complete = createScheduledNvidiaCompletion({
  timeoutMs: 10_000,
  async complete(payload, signal) {
    calls += 1;
    receivedSignal = signal;
    return { ok: true, payload };
  }
});
const result = await complete({ model: 'test' });
assert.deepEqual(result, { ok: true, payload: { model: 'test' } });
assert.equal(calls, 1);
assert.equal(receivedSignal instanceof AbortSignal, true);
assert.equal(receivedSignal.aborted, false);

const aborted = new AbortController();
aborted.abort();
await assert.rejects(
  () => complete({}, aborted.signal),
  (error) => error?.code === 'SCHEDULE_AGENT_RUN_CANCELLED'
);
assert.equal(calls, 1);

await assert.rejects(
  () => complete({}, {}),
  /INVALID_SCHEDULE_NVIDIA_SIGNAL/
);

process.stdout.write('scheduled NVIDIA completion helpers passed\n');
