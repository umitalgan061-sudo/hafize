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

const calls = [];
const writes = [];
const runtime = {
  async handle(input) {
    calls.push(input);
    if (input.pathname.endsWith('/prepare')) {
      return {
        matched: true,
        status: 200,
        body: {
          approvalToken: 'opaque-token',
          expiresAt: '2026-08-15T11:00:00.000Z',
          command: { type: 'create_branch', repository: 'umitalgan061-sudo/hafize' }
        }
      };
    }
    return { matched: true, status: 200, body: { receipt: { ok: true } } };
  }
};
const route = createGitHubWriteNodeHttpRoute({
  runtime,
  sendJson(response, status, body) {
    writes.push({ response, status, body });
    response.end();
  }
});

const ignored = await route.handle({
  request: {},
  response: new FakeResponse(),
  method: 'GET',
  pathname: '/api/health'
});
assert.deepEqual(ignored, { matched: false });
assert.equal(calls.length, 0, 'unrelated paths must not reach write runtime');
assert.equal(writes.length, 0);

const prepareResponse = new FakeResponse();
const prepare = await route.handle({
  request: { id: 'prepare-request' },
  response: prepareResponse,
  method: 'POST',
  pathname: '/api/github/write/prepare',
  headers: { authorization: 'Bearer user-token' }
});
assert.deepEqual(prepare, { matched: true, status: 200 });
assert.equal(calls.length, 1);
assert.equal(calls[0].request.id, 'prepare-request');
assert.equal(calls[0].method, 'POST');
assert.equal(calls[0].pathname, '/api/github/write/prepare');
assert.equal(calls[0].headers.authorization, 'Bearer user-token');
assert.ok(calls[0].signal instanceof AbortSignal);
assert.equal(calls[0].signal.aborted, false);
assert.equal(writes.length, 1);
assert.equal(writes[0].status, 200);
assert.equal(writes[0].body.approvalToken, 'opaque-token');
assert.equal(prepareResponse.writableEnded, true);

const executeResponse = new FakeResponse();
const execute = await route.handle({
  request: { id: 'execute-request' },
  response: executeResponse,
  method: 'POST',
  pathname: '/api/github/write/execute',
  headers: { authorization: 'Bearer user-token' }
});
assert.deepEqual(execute, { matched: true, status: 200 });
assert.equal(calls.length, 2);
assert.equal(calls[1].request.id, 'execute-request');
assert.equal(calls[1].pathname, '/api/github/write/execute');
assert.equal(writes.length, 2);
assert.deepEqual(writes[1].body, { receipt: { ok: true } });

const methodRuntime = {
  async handle() {
    return { matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
  }
};
const methodWrites = [];
const methodRoute = createGitHubWriteNodeHttpRoute({
  runtime: methodRuntime,
  sendJson(response, status, body) {
    methodWrites.push({ status, body });
    response.end();
  }
});
const wrongMethod = await methodRoute.handle({
  request: {},
  response: new FakeResponse(),
  method: 'GET',
  pathname: '/api/github/write/prepare'
});
assert.deepEqual(wrongMethod, { matched: true, status: 405 });
assert.deepEqual(methodWrites, [{ status: 405, body: { error: 'METHOD_NOT_ALLOWED' } }]);

const unmatchedRuntime = { async handle() { return { matched: false }; } };
const unmatchedRoute = createGitHubWriteNodeHttpRoute({
  runtime: unmatchedRuntime,
  sendJson() { throw new Error('must not write'); }
});
assert.deepEqual(await unmatchedRoute.handle({
  request: {},
  response: new FakeResponse(),
  method: 'POST',
  pathname: '/api/github/write/prepare'
}), { matched: false });

console.log('GitHub write Node HTTP route tests passed');
