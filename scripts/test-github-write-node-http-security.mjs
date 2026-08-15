import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createGitHubWriteNodeHttpRoute } from '../lib/github-write-node-http-route.mjs';

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
    this.writableEnded = false;
  }
  end() { this.writableEnded = true; }
}

function createWriterSink() {
  const writes = [];
  return {
    writes,
    sendJson(response, status, body) {
      writes.push({ status, body });
      response.end();
    }
  };
}

let resolvePending;
let seenSignal;
const pendingRuntime = {
  async handle({ signal }) {
    seenSignal = signal;
    await new Promise((resolve) => { resolvePending = resolve; });
    return { matched: true, status: 200, body: { receipt: { ok: true } } };
  }
};
const pendingSink = createWriterSink();
const pendingRoute = createGitHubWriteNodeHttpRoute({ runtime: pendingRuntime, sendJson: pendingSink.sendJson });
const pendingResponse = new FakeResponse();
const pendingPromise = pendingRoute.handle({
  request: {},
  response: pendingResponse,
  method: 'POST',
  pathname: '/api/github/write/execute',
  headers: { authorization: 'Bearer opaque' }
});
await Promise.resolve();
assert.ok(seenSignal instanceof AbortSignal);
assert.equal(seenSignal.aborted, false);
pendingResponse.emit('close');
assert.equal(seenSignal.aborted, true, 'response close must cancel the write execution signal');
resolvePending();
assert.deepEqual(await pendingPromise, { matched: true, aborted: true });
assert.equal(pendingSink.writes.length, 0, 'closed response must never receive write result');

const endedSink = createWriterSink();
const endedRoute = createGitHubWriteNodeHttpRoute({
  runtime: {
    async handle() {
      return { matched: true, status: 200, body: { approvalToken: 'opaque' } };
    }
  },
  sendJson: endedSink.sendJson
});
const endedResponse = new FakeResponse();
endedResponse.writableEnded = true;
assert.deepEqual(await endedRoute.handle({
  request: {},
  response: endedResponse,
  method: 'POST',
  pathname: '/api/github/write/prepare'
}), { matched: true, aborted: true });
assert.equal(endedSink.writes.length, 0);

const destroyedSink = createWriterSink();
const destroyedRoute = createGitHubWriteNodeHttpRoute({
  runtime: {
    async handle() {
      return { matched: true, status: 200, body: { approvalToken: 'opaque' } };
    }
  },
  sendJson: destroyedSink.sendJson
});
const destroyedResponse = new FakeResponse();
destroyedResponse.destroyed = true;
assert.deepEqual(await destroyedRoute.handle({
  request: {},
  response: destroyedResponse,
  method: 'POST',
  pathname: '/api/github/write/prepare'
}), { matched: true, aborted: true });
assert.equal(destroyedSink.writes.length, 0);

for (const invalid of [
  null,
  {},
  { matched: true, status: '200', body: {} },
  { matched: true, status: 99, body: {} },
  { matched: true, status: 600, body: {} },
  { matched: true, status: 200, body: null },
  { matched: true, status: 200, body: [] },
  { matched: true, status: 200, body: 'secret-shaped-string' }
]) {
  const sink = createWriterSink();
  const route = createGitHubWriteNodeHttpRoute({
    runtime: { async handle() { return invalid; } },
    sendJson: sink.sendJson
  });
  if (invalid?.matched !== true) {
    assert.deepEqual(await route.handle({
      request: {}, response: new FakeResponse(), method: 'POST', pathname: '/api/github/write/prepare'
    }), { matched: false });
  } else {
    await assert.rejects(
      route.handle({
        request: {}, response: new FakeResponse(), method: 'POST', pathname: '/api/github/write/prepare'
      }),
      /INVALID_GITHUB_WRITE_NODE_HTTP_RESPONSE/
    );
  }
  assert.equal(sink.writes.length, 0);
}

assert.throws(
  () => createGitHubWriteNodeHttpRoute({ runtime: {}, sendJson() {} }),
  /INVALID_GITHUB_WRITE_NODE_HTTP:runtime/
);
assert.throws(
  () => createGitHubWriteNodeHttpRoute({ runtime: { handle() {} } }),
  /INVALID_GITHUB_WRITE_NODE_HTTP:sendJson/
);
const validRoute = createGitHubWriteNodeHttpRoute({ runtime: { async handle() { return { matched: false }; } }, sendJson() {} });
await assert.rejects(
  validRoute.handle({ request: {}, response: null, method: 'POST', pathname: '/api/github/write/prepare' }),
  /INVALID_GITHUB_WRITE_NODE_HTTP:response/
);

console.log('GitHub write Node HTTP security tests passed');
