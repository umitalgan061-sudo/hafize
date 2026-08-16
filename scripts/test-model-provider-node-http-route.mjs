import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createModelProviderNodeHttpRoute } from '../lib/model-provider-node-http-route.mjs';

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = new Map();
    this.status = null;
    this.chunks = [];
    this.writableEnded = false;
    this.securityApplied = false;
  }
  setHeader(name, value) { this.headers.set(String(name).toLowerCase(), String(value)); }
  writeHead(status) { this.status = status; }
  write(chunk) { this.chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)); return true; }
  end(chunk) { if (chunk != null) this.write(chunk); this.writableEnded = true; }
}

function createHarness(runtime) {
  const jsonCalls = [];
  const route = createModelProviderNodeHttpRoute({
    runtime,
    sendJson(response, status, body) {
      jsonCalls.push({ status, body });
      response.status = status;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(body));
    },
    setSecurityHeaders(response) {
      response.securityApplied = true;
      response.setHeader('X-Content-Type-Options', 'nosniff');
    }
  });
  return { route, jsonCalls };
}

{
  const calls = [];
  const { route, jsonCalls } = createHarness({
    async handle(input) {
      calls.push(input);
      return {
        matched: true,
        status: 200,
        kind: 'json',
        body: { models: ['model-a', 'local:qwen'] },
        headers: { 'Cache-Control': 'no-store' }
      };
    }
  });
  const response = new FakeResponse();
  const result = await route.handle({
    request: { id: 'request-models' }, response, method: 'GET', pathname: '/api/models', headers: { accept: 'application/json' }
  });
  assert.deepEqual(result, { matched: true, kind: 'json', status: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, '/api/models');
  assert.equal(calls[0].signal instanceof AbortSignal, true);
  assert.equal(jsonCalls.length, 1);
  assert.deepEqual(jsonCalls[0].body, { models: ['model-a', 'local:qwen'] });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.writableEnded, true);
}

{
  const chunks = ['data: {"choices":[{"delta":{"content":"Mer"}}]}\n\n', 'data: [DONE]\n\n'];
  const { route } = createHarness({
    async handle() {
      return {
        matched: true,
        status: 200,
        kind: 'stream',
        body: {
          async *[Symbol.asyncIterator]() {
            for (const chunk of chunks) yield Buffer.from(chunk);
          }
        },
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Hafize-Trace-Id': 'trace-provider-chat'
        }
      };
    }
  });
  const response = new FakeResponse();
  const result = await route.handle({ request: {}, response, method: 'POST', pathname: '/api/chat' });
  assert.equal(result.matched, true);
  assert.equal(result.kind, 'stream');
  assert.equal(result.interrupted, false);
  assert.equal(result.aborted, false);
  assert.equal(response.securityApplied, true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(response.headers.get('x-hafize-trace-id'), 'trace-provider-chat');
  assert.equal(response.chunks.join(''), chunks.join(''));
  assert.equal(response.writableEnded, true);
}

{
  const { route } = createHarness({ async handle() { throw new Error('should not run'); } });
  const response = new FakeResponse();
  assert.deepEqual(
    await route.handle({ request: {}, response, method: 'GET', pathname: '/api/health' }),
    { matched: false }
  );
}

assert.throws(
  () => createModelProviderNodeHttpRoute({ runtime: {}, sendJson() {}, setSecurityHeaders() {} }),
  /INVALID_MODEL_PROVIDER_NODE_HTTP:runtime/
);
assert.throws(
  () => createModelProviderNodeHttpRoute({ runtime: { handle() {} }, sendJson: null, setSecurityHeaders() {} }),
  /INVALID_MODEL_PROVIDER_NODE_HTTP:sendJson/
);

console.log('model provider Node HTTP route tests passed');
