import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  createModelProviderNodeHttpRoute,
  safeLateStreamError
} from '../lib/model-provider-node-http-route.mjs';

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = new Map();
    this.status = null;
    this.ended = false;
    this.destroyed = false;
    this.writableEnded = false;
    this.writableFinished = false;
  }
  setHeader(name, value) { this.headers.set(name, value); }
  writeHead(status) { this.status = status; }
  end() { this.ended = true; this.writableEnded = true; }
}

function throwingBody(error) {
  return {
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('data: {"partial":true}\n\n');
      throw error;
    }
  };
}

function makeRuntime(error) {
  return {
    async handle() {
      return {
        matched: true,
        kind: 'stream',
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        body: throwingBody(error)
      };
    }
  };
}

function makeWriter(log) {
  return {
    writable() { return true; },
    async pipe(body) {
      for await (const chunk of body) log.chunks.push(chunk.toString('utf8'));
      return { ok: true, aborted: false };
    },
    async writeError(code) {
      log.errors.push(code);
      return true;
    },
    end() { log.ended += 1; return true; }
  };
}

const safeCodes = [
  'NVIDIA_STREAM_TIMEOUT',
  'NVIDIA_STREAM_TOO_LARGE',
  'NVIDIA_STREAM_CHUNK_TOO_LARGE',
  'INVALID_PROVIDER_STREAM'
];

for (const code of safeCodes) {
  assert.equal(safeLateStreamError(Object.assign(new Error('private'), { code })), code);
  const log = { chunks: [], errors: [], ended: 0 };
  const response = new FakeResponse();
  const route = createModelProviderNodeHttpRoute({
    runtime: makeRuntime(Object.assign(new Error('private provider detail'), { code })),
    sendJson() { throw new Error('unexpected json'); },
    setSecurityHeaders() {},
    createStreamWriter() { return makeWriter(log); }
  });
  const result = await route.handle({
    request: {}, response, method: 'POST', pathname: '/api/chat', headers: {}
  });
  assert.equal(response.status, 200);
  assert.equal(result.interrupted, true);
  assert.equal(result.streamError, code);
  assert.deepEqual(log.errors, [code]);
  assert.equal(log.ended, 1);
  assert.equal(JSON.stringify(result).includes('private provider detail'), false);
}

{
  const privateError = Object.assign(new Error('Authorization: Bearer super-secret'), {
    code: 'PRIVATE_UPSTREAM_FAILURE'
  });
  assert.equal(safeLateStreamError(privateError), 'STREAM_INTERRUPTED');
  const log = { chunks: [], errors: [], ended: 0 };
  const response = new FakeResponse();
  const route = createModelProviderNodeHttpRoute({
    runtime: makeRuntime(privateError),
    sendJson() { throw new Error('unexpected json'); },
    setSecurityHeaders() {},
    createStreamWriter() { return makeWriter(log); }
  });
  const result = await route.handle({
    request: {}, response, method: 'POST', pathname: '/api/chat', headers: {}
  });
  assert.equal(result.streamError, 'STREAM_INTERRUPTED');
  assert.deepEqual(log.errors, ['STREAM_INTERRUPTED']);
  assert.equal(JSON.stringify(result).includes('super-secret'), false);
}

{
  const log = { chunks: [], errors: [], ended: 0 };
  const response = new FakeResponse();
  const route = createModelProviderNodeHttpRoute({
    runtime: {
      async handle() {
        return {
          matched: true,
          kind: 'stream',
          status: 200,
          headers: {},
          body: {
            async *[Symbol.asyncIterator]() {
              yield Buffer.from('data: [DONE]\n\n');
            }
          }
        };
      }
    },
    sendJson() { throw new Error('unexpected json'); },
    setSecurityHeaders() {},
    createStreamWriter() { return makeWriter(log); }
  });
  const result = await route.handle({
    request: {}, response, method: 'POST', pathname: '/api/chat', headers: {}
  });
  assert.equal(result.interrupted, false);
  assert.equal(result.streamError, null);
  assert.deepEqual(log.errors, []);
  assert.equal(log.ended, 1);
}

{
  const error = Object.assign(new Error('timeout'), { code: 'NVIDIA_STREAM_TIMEOUT' });
  const log = { chunks: [], errors: [], ended: 0 };
  const response = new FakeResponse();
  const route = createModelProviderNodeHttpRoute({
    runtime: makeRuntime(error),
    sendJson() { throw new Error('unexpected json'); },
    setSecurityHeaders() {},
    createStreamWriter() {
      const writer = makeWriter(log);
      writer.writable = () => false;
      return writer;
    }
  });
  const result = await route.handle({
    request: {}, response, method: 'POST', pathname: '/api/chat', headers: {}
  });
  assert.equal(result.interrupted, true);
  assert.deepEqual(log.errors, [], 'closed output must not receive a trailing error frame');
}

process.stdout.write('model provider late stream error tests passed\n');
