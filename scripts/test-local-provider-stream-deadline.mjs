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

let invalidSignal = null;
const invalidBody = createLocalProviderStreamDeadline(async (_payload, { signal }) => {
  invalidSignal = signal;
  return null;
}, { timeoutMs: 5_000 });
await assert.rejects(
  () => invalidBody({}, {}),
  (error) => error?.code === 'INVALID_LOCAL_PROVIDER_STREAM' && error?.status === 502
);
assert.equal(invalidSignal.aborted, true, 'invalid provider body must release the owned request signal');
assert.equal(invalidSignal.reason?.code, 'INVALID_LOCAL_PROVIDER_STREAM');

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
let timeoutGuard = null;
try {
  await Promise.race([
    assert.rejects(timedBody[Symbol.asyncIterator]().next(), (error) => {
      assert.equal(error.code, 'LOCAL_PROVIDER_STREAM_TIMEOUT');
      assert.equal(error.status, 504);
      return true;
    }),
    new Promise((_, reject) => {
      timeoutGuard = setTimeout(() => reject(new Error('LOCAL_PROVIDER_STREAM_TIMEOUT_NOT_OBSERVED')), 1_500);
    })
  ]);
} finally {
  clearTimeout(timeoutGuard);
}
assert.equal(timedSignal.aborted, true);

let earlyFinally = 0;
let earlySignal = null;
const early = createLocalProviderStreamDeadline(async (_payload, { signal }) => {
  earlySignal = signal;
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      try {
        yield encoder.encode('first');
        yield encoder.encode('second');
      } finally {
        earlyFinally += 1;
      }
    }
  });
}, { timeoutMs: 1_000 });
for await (const chunk of await early({}, {})) {
  assert.equal(Buffer.from(chunk).toString('utf8'), 'first');
  break;
}
assert.equal(earlyFinally, 1, 'consumer early-return must close the wrapped upstream iterator');
assert.equal(earlySignal.aborted, true, 'consumer early-return must cancel the owned local-provider request');
assert.equal(earlySignal.reason?.code, 'LOCAL_PROVIDER_CANCELLED');

let failureSignal = null;
const providerFailure = new Error('LOCAL_STREAM_BAD_CHUNK');
providerFailure.code = 'LOCAL_STREAM_BAD_CHUNK';
const failing = createLocalProviderStreamDeadline(async (_payload, { signal }) => {
  failureSignal = signal;
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      throw providerFailure;
    }
  });
}, { timeoutMs: 5_000 });
const failingBody = await failing({}, {});
await assert.rejects(failingBody[Symbol.asyncIterator]().next(), (error) => error === providerFailure);
assert.equal(failureSignal.aborted, true, 'provider stream errors must cancel the owned request');
assert.equal(failureSignal.reason, providerFailure, 'provider error identity must be preserved as abort reason');

console.log('local provider stream deadline tests passed');
