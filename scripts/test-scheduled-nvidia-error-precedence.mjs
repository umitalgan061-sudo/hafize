import assert from 'node:assert/strict';
import { createScheduledNvidiaCompletion } from '../lib/scheduled-nvidia-completion.mjs';

let disposeCalls = 0;
const providerError = Object.assign(new Error('provider exploded'), { code: 'NVIDIA_CHAT_ERROR', status: 502 });
const completion = createScheduledNvidiaCompletion({
  timeoutMs: 30_000,
  createAbortRuntime({ signal }) {
    return {
      signal: signal || new AbortController().signal,
      dispose() { disposeCalls += 1; },
      isTimedOut() { return false; }
    };
  },
  async complete() {
    throw providerError;
  }
});

await assert.rejects(
  () => completion({}),
  (error) => error === providerError
);
assert.equal(disposeCalls, 1);

const caller = new AbortController();
const raceCompletion = createScheduledNvidiaCompletion({
  timeoutMs: 30_000,
  createAbortRuntime() {
    return {
      signal: new AbortController().signal,
      dispose() {},
      isTimedOut() { return true; }
    };
  },
  async complete() {
    caller.abort();
    throw new Error('late timeout');
  }
});
await assert.rejects(
  () => raceCompletion({}, caller.signal),
  (error) => error?.code === 'SCHEDULE_AGENT_RUN_CANCELLED'
);

process.stdout.write('scheduled NVIDIA error precedence passed\n');
