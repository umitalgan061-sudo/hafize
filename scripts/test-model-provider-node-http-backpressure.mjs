import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createModelProviderNodeHttpRoute } from '../lib/model-provider-node-http-route.mjs';
import { createSseNodeWriter } from '../lib/sse-node-writer.mjs';

class FakeResponse extends EventEmitter {
  constructor({ backpressureAt = [] } = {}) {
    super();
    this.backpressureAt = new Set(backpressureAt);
    this.headers = new Map();
    this.writes = [];
    this.status = null;
    this.endCount = 0;
    this.destroyed = false;
    this.writableEnded = false;
    this.writableFinished = false;
  }

  setHeader(name, value) {
    this.headers.set(String(name).toLowerCase(), value);
  }

  writeHead(status) {
    this.status = status;
  }

  write(chunk) {
    const index = this.writes.length;
    this.writes.push(chunk);
    if (this.destroyed || this.writableEnded) throw new Error('WRITE_AFTER_END');
    return !this.backpressureAt.has(index);
  }

  end() {
    this.endCount += 1;
    this.writableEnded = true;
  }
}

function createRoute(runtime, createStreamWriter) {
  return createModelProviderNodeHttpRoute({
    runtime,
    createStreamWriter,
    sendJson(response, status, body) {
      response.writeHead(status);
      response.end(JSON.stringify(body));
    },
    setSecurityHeaders(response) {
      response.setHeader('x-content-type-options', 'nosniff');
    }
  });
}

async function* chunks(values, events = []) {
  for (let index = 0; index < values.length; index += 1) {
    events.push(`yield:${index}`);
    yield values[index];
  }
}

const events = [];
const runtime = {
  async handle({ signal }) {
    assert.equal(signal.aborted, false);
    return {
      matched: true,
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: chunks(['data: a\n\n', 'data: b\n\n', 'data: [DONE]\n\n'], events)
    };
  }
};
const response = new FakeResponse({ backpressureAt: [0] });
const route = createRoute(runtime);
let done = false;
const pending = route.handle({
  request: {},
  response,
  method: 'POST',
  pathname: '/api/chat',
  headers: { accept: 'text/event-stream' }
}).then((value) => {
  done = true;
  return value;
});

await new Promise((resolve) => setImmediate(resolve));
assert.equal(done, false, 'route must pause upstream iteration until drain');
assert.deepEqual(response.writes, ['data: a\n\n']);
assert.deepEqual(events, ['yield:0']);
response.emit('drain');
const result = await pending;
assert.deepEqual(result, {
  matched: true,
  kind: 'stream',
  status: 200,
  aborted: false,
  interrupted: false,
  streamError: null
});
assert.deepEqual(response.writes, ['data: a\n\n', 'data: b\n\n', 'data: [DONE]\n\n']);
assert.equal(response.endCount, 1);
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');

let sawAbort = false;
const abortRuntime = {
  async handle({ signal }) {
    signal.addEventListener('abort', () => { sawAbort = true; }, { once: true });
    return {
      matched: true,
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: chunks(['data: wait\n\n', 'data: never\n\n'])
    };
  }
};
const disconnect = new FakeResponse({ backpressureAt: [0] });
const disconnectPending = createRoute(abortRuntime).handle({
  request: {}, response: disconnect, method: 'POST', pathname: '/api/chat'
});
await new Promise((resolve) => setImmediate(resolve));
disconnect.destroyed = true;
disconnect.emit('close');
const disconnectResult = await disconnectPending;
assert.equal(sawAbort, true);
assert.equal(disconnectResult.aborted, true);
assert.equal(disconnectResult.interrupted, false);
assert.deepEqual(disconnect.writes, ['data: wait\n\n']);
assert.equal(disconnect.endCount, 0, 'destroyed socket must not be ended again');

const errorRuntime = {
  async handle() {
    async function* broken() {
      yield 'data: first\n\n';
      throw new Error('upstream broke');
    }
    return {
      matched: true,
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: broken()
    };
  }
};
const errored = new FakeResponse();
const errorResult = await createRoute(errorRuntime).handle({
  request: {}, response: errored, method: 'POST', pathname: '/api/chat'
});
assert.equal(errorResult.interrupted, true);
assert.equal(errorResult.aborted, false);
assert.deepEqual(errored.writes, [
  'data: first\n\n',
  'data: {"error":"STREAM_INTERRUPTED"}\n\n'
]);
assert.equal(errored.endCount, 1);

const timeoutRuntime = {
  async handle() {
    return {
      matched: true,
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: chunks(['data: blocked\n\n', 'data: must-not-advance\n\n'])
    };
  }
};
const timedOut = new FakeResponse({ backpressureAt: [0, 1] });
const startedAt = Date.now();
const timeoutResult = await createRoute(
  timeoutRuntime,
  (options) => createSseNodeWriter({ ...options, drainTimeoutMs: 100 })
).handle({
  request: {}, response: timedOut, method: 'POST', pathname: '/api/chat'
});
assert.equal(timeoutResult.interrupted, true);
assert.equal(timeoutResult.aborted, false);
assert.ok(Date.now() - startedAt >= 70, 'route must honor injected bounded drain timeout');
assert.deepEqual(timedOut.writes, ['data: blocked\n\n', 'data: {"error":"STREAM_INTERRUPTED"}\n\n']);
assert.equal(timedOut.endCount, 1);

const jsonRuntime = {
  async handle() {
    return { matched: true, kind: 'json', status: 400, headers: {}, body: { error: 'BAD' } };
  }
};
const jsonResponse = new FakeResponse();
const jsonResult = await createRoute(jsonRuntime).handle({
  request: {}, response: jsonResponse, method: 'POST', pathname: '/api/chat'
});
assert.deepEqual(jsonResult, { matched: true, kind: 'json', status: 400 });
assert.equal(jsonResponse.status, 400);
assert.equal(jsonResponse.writes.length, 0, 'JSON path must not enter SSE writer');

const unmatched = await createRoute({ async handle() { throw new Error('must not run'); } }).handle({
  response: new FakeResponse(), method: 'GET', pathname: '/other'
});
assert.deepEqual(unmatched, { matched: false });

console.log('model provider node http backpressure tests passed');
