import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  DEFAULT_MAX_CHUNK_BYTES,
  chunkByteLength,
  createSseNodeWriter,
  isWritable,
  normalizeMaxChunkBytes
} from '../lib/sse-node-writer.mjs';

class FakeResponse extends EventEmitter {
  constructor(results = []) {
    super();
    this.results = [...results];
    this.writes = [];
    this.ends = [];
    this.destroyed = false;
    this.writableEnded = false;
    this.writableFinished = false;
  }

  write(chunk) {
    this.writes.push(chunk);
    if (this.destroyed || this.writableEnded) throw new Error('WRITE_AFTER_END');
    return this.results.length ? this.results.shift() : true;
  }

  end(chunk) {
    if (this.writableEnded) throw new Error('DOUBLE_END');
    if (chunk !== undefined) this.ends.push(chunk);
    this.writableEnded = true;
  }
}

assert.equal(DEFAULT_MAX_CHUNK_BYTES, 256 * 1024);
assert.equal(normalizeMaxChunkBytes(), DEFAULT_MAX_CHUNK_BYTES);
assert.equal(normalizeMaxChunkBytes(1024), 1024);
assert.equal(normalizeMaxChunkBytes(1024 * 1024), 1024 * 1024);
assert.throws(() => normalizeMaxChunkBytes(1023), /INVALID_SSE_NODE_WRITER_MAX_CHUNK_BYTES/);
assert.throws(() => normalizeMaxChunkBytes(1024 * 1024 + 1), /INVALID_SSE_NODE_WRITER_MAX_CHUNK_BYTES/);
assert.throws(() => normalizeMaxChunkBytes(1.5), /INVALID_SSE_NODE_WRITER_MAX_CHUNK_BYTES/);

assert.equal(chunkByteLength('abc'), 3);
assert.equal(chunkByteLength('😀'), 4);
assert.equal(chunkByteLength(new Uint8Array([1, 2, 3])), 3);
assert.throws(() => chunkByteLength({}), /INVALID_SSE_NODE_WRITER_CHUNK/);

const response = new FakeResponse();
const writer = createSseNodeWriter({ response });
assert.equal(writer.writable(), true);
assert.equal(await writer.write('data: one\n\n'), true);
assert.deepEqual(response.writes, ['data: one\n\n']);
assert.equal(await writer.writeEvent({ ok: true }), true);
assert.equal(response.writes[1], 'data: {"ok":true}\n\n');
assert.equal(await writer.writeEvent({ label: 'tool' }, { event: 'hafize-tool-activity' }), true);
assert.equal(response.writes[2], 'event: hafize-tool-activity\ndata: {"label":"tool"}\n\n');
assert.equal(await writer.writeError('STREAM_INTERRUPTED'), true);
assert.equal(response.writes[3], 'data: {"error":"STREAM_INTERRUPTED"}\n\n');
assert.throws(() => writer.writeError('bad-code'), /INVALID_SSE_ERROR_CODE/);
assert.equal(writer.end(), true);
assert.equal(writer.writable(), false);
assert.equal(await writer.write('late'), false);
assert.equal(writer.end(), false);

const bounded = createSseNodeWriter({ response: new FakeResponse(), maxChunkBytes: 1024 });
await assert.rejects(() => bounded.write('x'.repeat(1025)), /SSE_OUTPUT_CHUNK_TOO_LARGE/);
assert.equal(await bounded.write('x'.repeat(1024)), true);

const abortController = new AbortController();
const abortedResponse = new FakeResponse();
const abortedWriter = createSseNodeWriter({ response: abortedResponse, signal: abortController.signal });
abortController.abort();
assert.equal(abortedWriter.writable(), false);
assert.equal(await abortedWriter.write('nope'), false);
assert.deepEqual(abortedResponse.writes, []);

const destroyed = new FakeResponse();
destroyed.destroyed = true;
assert.equal(isWritable(destroyed), false);
assert.equal(createSseNodeWriter({ response: destroyed }).end(), false);

const ended = new FakeResponse();
ended.writableEnded = true;
assert.equal(isWritable(ended), false);

const finished = new FakeResponse();
finished.writableFinished = true;
assert.equal(isWritable(finished), false);

assert.throws(() => createSseNodeWriter({ response: {} }), /INVALID_SSE_NODE_WRITER_RESPONSE/);

async function* source() {
  yield 'data: a\n\n';
  yield new TextEncoder().encode('data: b\n\n');
}
const pipedResponse = new FakeResponse();
const piped = await createSseNodeWriter({ response: pipedResponse }).pipe(source());
assert.deepEqual(piped, { ok: true, aborted: false, chunks: 2, bytes: 18 });
assert.equal(pipedResponse.writes.length, 2);

await assert.rejects(
  () => createSseNodeWriter({ response: new FakeResponse() }).pipe([]),
  /INVALID_SSE_NODE_WRITER_ITERABLE/
);

console.log('sse node writer tests passed');
