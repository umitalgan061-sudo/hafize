import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createAgentSseNodeSession } from '../lib/agent-sse-node-session.mjs';

class FakeResponse extends EventEmitter {
  constructor({ writePlan = [] } = {}) {
    super();
    this.writePlan = [...writePlan];
    this.writes = [];
    this.destroyed = false;
    this.writableEnded = false;
    this.writableFinished = false;
    this.headers = {};
  }

  writeHead(status, headers) {
    this.status = status;
    Object.assign(this.headers, headers);
  }

  write(chunk) {
    this.writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return this.writePlan.length ? this.writePlan.shift() : true;
  }

  end() {
    this.writableEnded = true;
  }
}

{
  const response = new FakeResponse();
  const session = createAgentSseNodeSession({ response });
  const huge = 'x'.repeat(256 * 1024 + 1);
  const result = await session.writeToolActivity({ detail: huge });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'SSE_OUTPUT_CHUNK_TOO_LARGE');
  assert.equal(response.writes.length, 0, 'oversized public activity must fail before response.write');
  session.end();
}

{
  const response = new FakeResponse({ writePlan: [false] });
  const session = createAgentSseNodeSession({ response, drainTimeoutMs: 100 });
  const started = Date.now();
  const keepAlive = setInterval(() => {}, 1000);
  let result;
  try {
    result = await session.writeToolActivity({ state: 'running' });
  } finally {
    clearInterval(keepAlive);
  }
  const elapsed = Date.now() - started;
  assert.equal(result.ok, false);
  assert.equal(result.error, 'SSE_OUTPUT_DRAIN_TIMEOUT');
  assert.ok(elapsed >= 80, `bounded drain timeout fired too early: ${elapsed}ms`);
  assert.ok(elapsed < 1000, `bounded drain timeout took too long: ${elapsed}ms`);
  session.end();
}

{
  const response = new FakeResponse({ writePlan: [false] });
  const session = createAgentSseNodeSession({ response, drainTimeoutMs: 1000 });
  const pending = session.writeToolActivity({ state: 'running' });
  response.destroyed = true;
  response.emit('close');
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.aborted, true);
  assert.equal(session.writable(), false);
  assert.equal(response.writes.length, 1);
}

{
  const response = new FakeResponse();
  const session = createAgentSseNodeSession({ response });
  const publicError = await session.writePublicError('bad-provider:token=value');
  assert.equal(publicError.ok, true);
  assert.match(response.writes.join(''), /"error":"STREAM_INTERRUPTED"/);
  assert.doesNotMatch(response.writes.join(''), /token=value/);
  session.end();
}

{
  const response = new FakeResponse();
  const session = createAgentSseNodeSession({ response });
  const invalid = await session.pipe({});
  assert.deepEqual(invalid, {
    ok: false,
    aborted: false,
    error: 'INVALID_UPSTREAM_STREAM',
    chunks: 0,
    bytes: 0
  });
  assert.equal(session.isStarted(), false, 'invalid upstream must not start SSE headers');
}

{
  const response = new FakeResponse();
  const chunks = [Buffer.from('data: one\n\n'), new Uint8Array(Buffer.from('data: iki\n\n'))];
  const session = createAgentSseNodeSession({ response });
  async function* source() {
    for (const chunk of chunks) yield chunk;
  }
  const result = await session.pipe(source());
  assert.equal(result.ok, true);
  assert.equal(result.chunks, 2);
  assert.equal(result.bytes, chunks[0].byteLength + chunks[1].byteLength);
  assert.equal(response.writes.join(''), 'data: one\n\ndata: iki\n\n');
  session.end();
}

const sourcePath = fileURLToPath(new URL('../lib/agent-sse-node-session.mjs', import.meta.url));
const source = await readFile(sourcePath, 'utf8');
for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/i,
  /document\.cookie/,
  /Authorization/i,
  /Bearer\s+/,
  /GITHUB_TOKEN/,
  /NVIDIA_API_KEY/,
  /shell\s*:\s*true/i,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `agent SSE session added forbidden surface: ${forbidden}`);
}
assert.match(source, /createSseNodeWriter/);
assert.match(source, /hafize-tool-activity/);
assert.match(source, /STREAM_INTERRUPTED/);
assert.match(source, /data: \[DONE\]/);

console.log('agent SSE node session boundary tests passed');
