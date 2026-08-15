import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createModelProviderNodeHttpRoute } from '../lib/model-provider-node-http-route.mjs';

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = new Map();
    this.chunks = [];
    this.writableEnded = false;
    this.status = null;
  }
  setHeader(name, value) { this.headers.set(String(name).toLowerCase(), String(value)); }
  writeHead(status) { this.status = status; }
  write(chunk) { this.chunks.push(String(chunk)); return true; }
  end() { this.writableEnded = true; }
}

function routeFor(runtime) {
  return createModelProviderNodeHttpRoute({
    runtime,
    sendJson(response, status, body) {
      response.status = status;
      response.end(JSON.stringify(body));
    },
    setSecurityHeaders() {}
  });
}

{
  let observedSignal = null;
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const route = routeFor({
    async handle({ signal }) {
      observedSignal = signal;
      await blocked;
      return { matched: true, status: 200, kind: 'json', body: { models: [] }, headers: {} };
    }
  });
  const response = new FakeResponse();
  const pending = route.handle({ request: {}, response, method: 'GET', pathname: '/api/models' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(observedSignal?.aborted, false);
  response.emit('close');
  assert.equal(observedSignal?.aborted, true);
  release();
  const result = await pending;
  assert.deepEqual(result, { matched: true, aborted: true });
  assert.equal(response.writableEnded, false);
}

{
  const route = routeFor({
    async handle() {
      return {
        matched: true,
        status: 200,
        kind: 'stream',
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        body: {
          async *[Symbol.asyncIterator]() {
            yield 'data: first\n\n';
            throw new Error('provider path /private/token=secret');
          }
        }
      };
    }
  });
  const response = new FakeResponse();
  const result = await route.handle({ request: {}, response, method: 'POST', pathname: '/api/chat' });
  assert.equal(result.interrupted, true);
  assert.equal(response.writableEnded, true);
  assert.match(response.chunks.join(''), /STREAM_INTERRUPTED/);
  assert.doesNotMatch(response.chunks.join(''), /private|token|secret/i);
}

{
  const route = routeFor({
    async handle() {
      return { matched: true, status: 200, kind: 'stream', headers: {}, body: {} };
    }
  });
  await assert.rejects(
    () => route.handle({ request: {}, response: new FakeResponse(), method: 'POST', pathname: '/api/chat' }),
    /INVALID_MODEL_PROVIDER_NODE_HTTP_RESPONSE/
  );
}

console.log('model provider Node HTTP cancellation tests passed');
