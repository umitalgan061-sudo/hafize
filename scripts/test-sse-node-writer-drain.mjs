import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createSseNodeWriter } from '../lib/sse-node-writer.mjs';

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.writes = [];
    this.endCount = 0;
    this.destroyed = false;
    this.writableEnded = false;
    this.writableFinished = false;
    this.backpressure = true;
  }

  write(chunk) {
    this.writes.push(chunk);
    if (this.destroyed || this.writableEnded) throw new Error('WRITE_AFTER_END');
    if (this.backpressure) {
      this.backpressure = false;
      return false;
    }
    return true;
  }

  end() {
    this.endCount += 1;
    this.writableEnded = true;
  }
}

const response = new FakeResponse();
const writer = createSseNodeWriter({ response });
let settled = false;
const pending = writer.write('data: slow\n\n').then((value) => {
  settled = true;
  return value;
});
await Promise.resolve();
assert.equal(settled, false, 'write must wait while response reports backpressure');
assert.equal(response.listenerCount('drain'), 1);
response.emit('drain');
assert.equal(await pending, true);
assert.equal(response.listenerCount('drain'), 0);
assert.equal(response.listenerCount('close'), 0);
assert.equal(response.listenerCount('error'), 0);

const closeResponse = new FakeResponse();
const closeWriter = createSseNodeWriter({ response: closeResponse });
const closePending = closeWriter.write('data: close\n\n');
await Promise.resolve();
closeResponse.destroyed = true;
closeResponse.emit('close');
assert.equal(await closePending, false);
assert.equal(closeWriter.writable(), false);
assert.equal(await closeWriter.writeError('STREAM_INTERRUPTED'), false);
assert.equal(closeWriter.end(), false);

const errorResponse = new FakeResponse();
const errorWriter = createSseNodeWriter({ response: errorResponse });
const errorPending = errorWriter.write('data: error\n\n');
await Promise.resolve();
errorResponse.destroyed = true;
errorResponse.emit('error', new Error('socket gone'));
assert.equal(await errorPending, false);
assert.equal(errorResponse.listenerCount('drain'), 0);
assert.equal(errorResponse.listenerCount('close'), 0);
assert.equal(errorResponse.listenerCount('error'), 0);

const controller = new AbortController();
const abortResponse = new FakeResponse();
const abortWriter = createSseNodeWriter({ response: abortResponse, signal: controller.signal });
const abortPending = abortWriter.write('data: abort\n\n');
await Promise.resolve();
controller.abort();
assert.equal(await abortPending, false);
assert.equal(abortResponse.listenerCount('drain'), 0);
assert.equal(abortResponse.listenerCount('close'), 0);
assert.equal(abortResponse.listenerCount('error'), 0);
assert.equal(await abortWriter.write('data: later\n\n'), false);

const concurrentResponse = new FakeResponse();
const concurrentWriter = createSseNodeWriter({ response: concurrentResponse });
const first = concurrentWriter.write('data: first\n\n');
await Promise.resolve();
await assert.rejects(() => concurrentWriter.write('data: second\n\n'), /SSE_OUTPUT_WRITE_CONCURRENT/);
concurrentResponse.emit('drain');
assert.equal(await first, true);
assert.deepEqual(concurrentResponse.writes, ['data: first\n\n']);

async function* many() {
  yield 'a';
  yield 'b';
  yield 'c';
}
const pipeResponse = new FakeResponse();
const pipeWriter = createSseNodeWriter({ response: pipeResponse });
const pipePromise = pipeWriter.pipe(many());
await Promise.resolve();
assert.deepEqual(pipeResponse.writes, ['a']);
pipeResponse.emit('drain');
const result = await pipePromise;
assert.deepEqual(result, { ok: true, aborted: false, chunks: 3, bytes: 3 });
assert.deepEqual(pipeResponse.writes, ['a', 'b', 'c']);

async function* closesMidstream(responseRef) {
  yield 'first';
  responseRef.destroyed = true;
  responseRef.emit('close');
  yield 'second';
}
const mid = new FakeResponse();
mid.backpressure = false;
const midResult = await createSseNodeWriter({ response: mid }).pipe(closesMidstream(mid));
assert.deepEqual(midResult, { ok: false, aborted: true, chunks: 1, bytes: 5 });
assert.deepEqual(mid.writes, ['first']);

console.log('sse node writer drain tests passed');
