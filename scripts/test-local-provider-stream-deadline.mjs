import assert from 'node:assert/strict';
import {
  createLocalProviderStreamDeadline,
  LOCAL_PROVIDER_STREAM_DEFAULTS
} from '../lib/local-provider-stream-deadline.mjs';

const encoder = new TextEncoder();

assert.deepEqual(LOCAL_PROVIDER_STREAM_DEFAULTS, {
  timeoutMs: 300_000,
  maxTimeoutMs: 600_000
});
assert.throws(() => createLocalProviderStreamDeadline(null), /INVALID_LOCAL_PROVIDER_STREAM_FUNCTION/);
for (const timeoutMs of [0, 999, 600_001, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(
    () => createLocalProviderStreamDeadline(async () => null, { timeoutMs }),
    /INVALID_LOCAL_PROVIDER_STREAM_TIMEOUT/
  );
}

let receivedSignal = null;
const caller = new AbortController();
const bounded = createLocalProviderStreamDeadline(async (_payload, { signal }) => {
  receivedSignal = signal;
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      yield encoder.encode('one');
      yield encoder.encode('two');
    }
  });
}, { timeoutMs: 5_000 });
const body = await bounded({ model: 'local:qwen' }, { signal: caller.signal });
assert.notEqual(receivedSignal, caller.signal, 'provider must receive the owned bounded signal');
assert.equal(receivedSignal.aborted, false);
const chunks = [];
for await (const chunk of body) chunks.push(Buffer.from(chunk).toString('utf8'));
assert.deepEqual(chunks, ['one', 'two']);
assert.equal(receivedSignal.aborted, false, 'normal completion must not synthesize an abort');

const invalidBody = createLocalProviderStreamDeadline(async () => null, { timeoutMs: 5_000 });
await assert.rejects(
  () => invalidBody({}, {}),
  /INVALID_LOCAL_PROVIDER_STREAM/
);

const cancelledCaller = new AbortController();
let cancellationSignal;
const cancellable = createLocalProviderStreamDeadline(async (_payload, { signal }) => {
  cancellationSignal = signal;
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      if (signal.aborted) throw signal.reason || new DOMException('aborted', 'AbortError');
      await new Promise((resolve, reject) => {
        const onAbort = () => reject(signal.reason || new DOMException('aborted', 'AbortError'));
        signal.addEventListener('abort', onAbort, { once: true });
      });
    }
  });
}, { timeoutMs: 5_000 });
const cancellableBody = await cancellable({}, { signal: cancelledCaller.signal });
const cancelledNext = cancellableBody[Symbol.asyncIterator]().next();
cancelledCaller.abort(new DOMException('caller cancelled', 'AbortError'));
await assert.rejects(cancelledNext, (error) => {
  assert.equal(error.code, 'LOCAL_PROVIDER_CANCELLED');
  assert.equal(error.status, 499);
  return true;
});
assert.equal(cancellationSignal.aborted, true);

let timedSignal;
const timed = createLocalProviderStreamDeadline(async (_payload, { signal }) => {
  timedSignal = signal;
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      await new Promise((resolve, reject) => {
        const onAbort = () => reject(signal.reason || new DOMException('aborted', 'AbortError'));
        signal.addEventListener('abort', onAbort, { once: true });
      });
    }
  });
}, { timeoutMs: 1_000 });
const timedBody = await timed({}, {});
await assert.rejects(timedBody[Symbol.asyncIterator]().next(), (error) => {
  assert.equal(error.code, 'LOCAL_PROVIDER_STREAM_TIMEOUT');
  assert.equal(error.status, 504);
  return true;
});
assert.equal(timedSignal.aborted, true);

let earlyFinally = 0;
const early = createLocalProviderStreamDeadline(async () => Object.freeze({
  async *[Symbol.asyncIterator]() {
    try {
      yield encoder.encode('first');
      yield encoder.encode('second');
    } finally {
      earlyFinally += 1;
    }
  }
}), { timeoutMs: 1_000 });
for await (const chunk of await early({}, {})) {
  assert.equal(Buffer.from(chunk).toString('utf8'), 'first');
  break;
}
assert.equal(earlyFinally, 1, 'consumer early-return must close the wrapped upstream iterator');

console.log('local provider stream deadline tests passed');
