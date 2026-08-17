import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  DEFAULT_DRAIN_TIMEOUT_MS,
  createSseNodeWriter,
  normalizeDrainTimeoutMs
} from '../lib/sse-node-writer.mjs';

class SlowResponse extends EventEmitter {
  constructor() {
    super();
    this.writes = [];
    this.ends = 0;
    this.destroyed = false;
    this.writableEnded = false;
    this.writableFinished = false;
  }
  write(chunk) {
    this.writes.push(chunk);
    return false;
  }
  end() {
    this.ends += 1;
    this.writableEnded = true;
  }
}

assert.equal(DEFAULT_DRAIN_TIMEOUT_MS, 30_000);
assert.equal(normalizeDrainTimeoutMs(), DEFAULT_DRAIN_TIMEOUT_MS);
assert.equal(normalizeDrainTimeoutMs(100), 100);
assert.equal(normalizeDrainTimeoutMs(120_000), 120_000);
for (const value of [0, 99, 120_001, 1.5, '1000']) {
  assert.throws(() => normalizeDrainTimeoutMs(value), /INVALID_SSE_NODE_WRITER_DRAIN_TIMEOUT/);
}

const response = new SlowResponse();
const writer = createSseNodeWriter({ response, drainTimeoutMs: 100 });
assert.equal(writer.drainTimeoutMs, 100);
const started = Date.now();
await assert.rejects(() => writer.write('data: blocked\n\n'), (error) => {
  assert.equal(error.code, 'SSE_OUTPUT_DRAIN_TIMEOUT');
  return true;
});
assert.ok(Date.now() - started >= 70, 'timeout should not resolve immediately');
assert.equal(response.listenerCount('drain'), 0);
assert.equal(response.listenerCount('close'), 0);
assert.equal(response.listenerCount('error'), 0);

// Writer can be ended safely after timeout; no extra chunk is produced.
assert.equal(writer.end(), true);
assert.equal(response.ends, 1);
assert.deepEqual(response.writes, ['data: blocked\n\n']);

// A drain arriving before timeout wins and fully cleans the timer/listeners.
const quick = new SlowResponse();
const quickWriter = createSseNodeWriter({ response: quick, drainTimeoutMs: 500 });
const quickPending = quickWriter.write('data: quick\n\n');
setTimeout(() => quick.emit('drain'), 10);
assert.equal(await quickPending, true);
assert.equal(quick.listenerCount('drain'), 0);
assert.equal(quick.listenerCount('close'), 0);
assert.equal(quick.listenerCount('error'), 0);

// Abort also wins before timeout and must resolve false rather than throw timeout.
const controller = new AbortController();
const abortResponse = new SlowResponse();
const abortWriter = createSseNodeWriter({
  response: abortResponse,
  signal: controller.signal,
  drainTimeoutMs: 500
});
const abortPending = abortWriter.write('data: abort\n\n');
setTimeout(() => controller.abort(), 10);
assert.equal(await abortPending, false);
assert.equal(abortResponse.listenerCount('drain'), 0);
assert.equal(abortResponse.listenerCount('close'), 0);
assert.equal(abortResponse.listenerCount('error'), 0);

console.log('sse node writer timeout tests passed');
