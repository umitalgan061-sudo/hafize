import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createAgentSseNodeSession } from '../lib/agent-sse-node-session.mjs';

function fakeResponse() {
  return {
    destroyed: false,
    writableEnded: false,
    writes: [],
    headers: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end() {
      this.writableEnded = true;
    }
  };
}

function writerFactory({
  writeEvent = async () => true,
  writeError = async () => true,
  write = async () => true,
  pipe = async () => ({ ok: true, aborted: false, chunks: 0, bytes: 0 }),
  writable = () => true,
  end = () => true
} = {}) {
  const calls = [];
  const factory = () => ({
    writable,
    async writeEvent(payload, options) {
      calls.push(['event', payload, options]);
      return writeEvent(payload, options);
    },
    async writeError(code) {
      calls.push(['error', code]);
      return writeError(code);
    },
    async write(chunk) {
      calls.push(['write', chunk]);
      return write(chunk);
    },
    async pipe(iterable) {
      calls.push(['pipe', iterable]);
      return pipe(iterable);
    },
    end() {
      calls.push(['end']);
      return end();
    }
  });
  return { factory, calls };
}

{
  const response = fakeResponse();
  const outputError = Object.assign(new Error('socket stayed blocked'), { code: 'SSE_OUTPUT_DRAIN_TIMEOUT' });
  const injected = writerFactory({
    writeEvent: async () => { throw outputError; },
    writable: () => true
  });
  const session = createAgentSseNodeSession({ response, createWriter: injected.factory });
  const result = await session.writeToolActivity({ state: 'running' });
  assert.deepEqual(result, { ok: false, aborted: false, error: 'SSE_OUTPUT_DRAIN_TIMEOUT' });
  assert.deepEqual(injected.calls.map(([kind]) => kind), ['event'], 'terminal output error must not start a second error write');
  session.end();
}

{
  const response = fakeResponse();
  const injected = writerFactory({
    pipe: async () => { throw new Error('upstream included secret=abc123'); }
  });
  const session = createAgentSseNodeSession({ response, createWriter: injected.factory });
  async function* source() { yield 'ignored'; }
  const result = await session.pipe(source());
  assert.equal(result.ok, false);
  assert.equal(result.error, 'STREAM_INTERRUPTED');
  assert.deepEqual(injected.calls.map(([kind]) => kind), ['pipe', 'error']);
  assert.equal(injected.calls[1][1], 'STREAM_INTERRUPTED');
  assert.doesNotMatch(JSON.stringify(injected.calls), /abc123/);
  session.end();
}

{
  const response = fakeResponse();
  const controller = new AbortController();
  const injected = writerFactory({
    pipe: async () => {
      controller.abort();
      throw new DOMException('aborted upstream detail', 'AbortError');
    },
    writable: () => false
  });
  const session = createAgentSseNodeSession({
    response,
    signal: controller.signal,
    createWriter: injected.factory
  });
  async function* source() { yield 'ignored'; }
  const result = await session.pipe(source());
  assert.equal(result.ok, false);
  assert.equal(result.aborted, true);
  assert.equal(result.error, 'SSE_OUTPUT_CLOSED');
  assert.deepEqual(injected.calls.map(([kind]) => kind), ['pipe'], 'abort must not emit a trailing public error frame');
  session.end();
}

{
  const response = fakeResponse();
  response.destroyed = true;
  let factoryCalls = 0;
  const session = createAgentSseNodeSession({
    response,
    createWriter() {
      factoryCalls += 1;
      throw new Error('must not run');
    }
  });
  const result = await session.writePublicError('NVIDIA_CHAT_ERROR');
  assert.equal(result.ok, false);
  assert.equal(result.aborted, true);
  assert.equal(factoryCalls, 0, 'closed response must fail before writer construction');
  assert.equal(response.headers, null);
}

{
  const response = fakeResponse();
  let writableState = true;
  const injected = writerFactory({ writable: () => writableState });
  const session = createAgentSseNodeSession({ response, createWriter: injected.factory });
  const first = await session.writeToolActivity({ state: 'running' });
  assert.equal(first.ok, true);
  writableState = false;
  const second = await session.writeToolActivity({ state: 'finished' });
  assert.equal(second.ok, false);
  assert.equal(second.aborted, true);
  assert.deepEqual(injected.calls.map(([kind]) => kind), ['event']);
  session.end();
}

const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
const registryPath = fileURLToPath(new URL('../agents/registry.json', import.meta.url));
const rulesPath = fileURLToPath(new URL('../HAFIZE_RULES.md', import.meta.url));
const [server, registryRaw, rules] = await Promise.all([
  readFile(serverPath, 'utf8'),
  readFile(registryPath, 'utf8'),
  readFile(rulesPath, 'utf8')
]);
const registry = JSON.parse(registryRaw);

const start = server.indexOf('async function handleAgentRun');
const end = server.indexOf('\nasync function serveStatic', start);
assert.ok(start >= 0 && end > start, 'handleAgentRun source must be extractable');
const agentRun = server.slice(start, end);
assert.doesNotMatch(agentRun, /\bres\.write\s*\(/, 'agent SSE route must not bypass bounded writer');
assert.doesNotMatch(agentRun, /\bres\.end\s*\(/, 'agent SSE route must end through the session boundary');
assert.doesNotMatch(agentRun, /upstream\.text\s*\(/, 'failed streaming response body must not be copied into memory');
assert.match(agentRun, /await sseSession\.writeToolActivity/);
assert.match(agentRun, /await sseSession\.pipe\(upstream\.body\)/);
assert.match(agentRun, /approvalGranted: false/);
assert.equal((agentRun.match(/controller\.abort\(\)/g) || []).length >= 2, true, 'disconnect/output failure must abort further agent work');

assert.equal(registry.agents.length, 4, 'SSE transport change must not expand agent roster');
assert.equal(registry.defaultAgent, 'minimal-engineer');
assert.deepEqual(registry.agents.map(({ id }) => id), [
  'minimal-engineer',
  'agency-code-reviewer',
  'movie-coordinator',
  'handyman-advisor'
]);
assert.equal(registry.agents.filter(({ kind }) => kind === 'selector').length, 2);
assert.equal(registry.agents.filter(({ kind }) => kind === 'specialist').length, 2);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);
assert.equal(registry.agents.every(({ toolPolicy }) => toolPolicy?.default === 'deny'), true, 'every active agent remains backend default-deny');
assert.match(rules, /1000/);

console.log('agent run SSE terminal error policy tests passed');
