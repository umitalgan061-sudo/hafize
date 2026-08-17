import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  SSE_HEADERS,
  contentFrame,
  createAgentSseNodeSession,
  isOutputFailure,
  normalizePublicErrorCode
} from '../lib/agent-sse-node-session.mjs';

class FakeResponse extends EventEmitter {
  constructor(writePlan = []) {
    super();
    this.writePlan = [...writePlan];
    this.headers = new Map();
    this.writes = [];
    this.status = null;
    this.destroyed = false;
    this.writableEnded = false;
    this.writableFinished = false;
    this.endCalls = 0;
  }

  setHeader(name, value) {
    this.headers.set(String(name).toLowerCase(), String(value));
  }

  writeHead(status, headers = {}) {
    this.status = status;
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    return this;
  }

  write(chunk) {
    this.writes.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    return this.writePlan.length ? this.writePlan.shift() : true;
  }

  end(chunk) {
    if (chunk !== undefined) this.writes.push(String(chunk));
    this.endCalls += 1;
    this.writableEnded = true;
  }
}

assert.deepEqual(contentFrame('merhaba'), { choices: [{ delta: { content: 'merhaba' } }] });
assert.throws(() => contentFrame(null), /INVALID_AGENT_SSE_CONTENT/);
assert.equal(normalizePublicErrorCode('NVIDIA_CHAT_ERROR'), 'NVIDIA_CHAT_ERROR');
assert.equal(normalizePublicErrorCode('bad-error'), 'STREAM_INTERRUPTED');
assert.equal(normalizePublicErrorCode('X'.repeat(81)), 'STREAM_INTERRUPTED');
assert.equal(isOutputFailure(Object.assign(new Error(), { code: 'SSE_OUTPUT_DRAIN_TIMEOUT' })), true);
assert.equal(isOutputFailure(Object.assign(new Error(), { code: 'INVALID_SSE_ERROR_CODE' })), true);
assert.equal(isOutputFailure(new Error('provider secret')), false);
assert.equal(SSE_HEADERS['Cache-Control'], 'no-cache, no-transform');

{
  const response = new FakeResponse();
  let securityCalls = 0;
  const session = createAgentSseNodeSession({
    response,
    setSecurityHeaders(target) {
      securityCalls += 1;
      target.setHeader('X-Test-Security', '1');
    }
  });

  assert.equal(session.isStarted(), false, 'session must be lazy before the first SSE write');
  const activity = await session.writeToolActivity({ tool: 'github.read_file', state: 'running' });
  assert.equal(activity.ok, true);
  assert.equal(session.isStarted(), true);
  assert.equal(securityCalls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-transform');
  assert.equal(response.headers.get('x-test-security'), '1');
  assert.match(response.writes[0], /^event: hafize-tool-activity\n/);
  assert.match(response.writes[0], /"state":"running"/);

  const content = await session.sendContent('tamam');
  assert.equal(content.ok, true);
  assert.match(response.writes[1], /"content":"tamam"/);
  assert.equal(response.writes[2], 'data: [DONE]\n\n');
  assert.equal(session.end(), true);
  assert.equal(session.end(), false, 'end must be idempotent');
  assert.equal(response.endCalls, 1);
}

{
  const response = new FakeResponse([false]);
  const session = createAgentSseNodeSession({ response });
  let settled = false;
  const pending = session.writeToolActivity({ tool: 'github.read_file', state: 'running' }).then((value) => {
    settled = true;
    return value;
  });

  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(settled, false, 'backpressured write must wait for drain');
  response.emit('drain');
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(settled, true);
  session.end();
}

{
  const response = new FakeResponse([false]);
  const controller = new AbortController();
  const session = createAgentSseNodeSession({ response, signal: controller.signal });
  const pending = session.writeToolActivity({ tool: 'gmail.message.list', state: 'running' });
  controller.abort();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.aborted, true);
  assert.equal(session.writable(), false);
  session.end();
}

{
  const response = new FakeResponse();
  const controller = new AbortController();
  controller.abort();
  const session = createAgentSseNodeSession({ response, signal: controller.signal });
  const result = await session.sendContent('gönderilmemeli');
  assert.equal(result.ok, false);
  assert.equal(result.aborted, true);
  assert.equal(response.status, null, 'aborted session must not even start response headers');
  assert.deepEqual(response.writes, []);
}

{
  const response = new FakeResponse();
  const session = createAgentSseNodeSession({ response });
  async function* brokenUpstream() {
    yield 'data: {"choices":[{"delta":{"content":"A"}}]}\n\n';
    throw new Error('provider-secret-value-must-not-leak');
  }

  const result = await session.pipe(brokenUpstream());
  assert.equal(result.ok, false);
  assert.equal(result.error, 'STREAM_INTERRUPTED');
  const output = response.writes.join('');
  assert.match(output, /"content":"A"/);
  assert.match(output, /"error":"STREAM_INTERRUPTED"/);
  assert.doesNotMatch(output, /provider-secret-value-must-not-leak/);
  session.end();
}

console.log('agent SSE node session tests passed');
