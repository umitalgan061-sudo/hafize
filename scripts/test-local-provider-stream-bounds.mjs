import assert from 'node:assert/strict';
import { createLocalOllamaProvider, LOCAL_PROVIDER_DEFAULTS } from '../lib/local-ollama-provider.mjs';

function headers(contentType) {
  return { get(name) { return String(name).toLowerCase() === 'content-type' ? contentType : null; } };
}

function streamResponse(chunks, contentType = 'text/event-stream; charset=utf-8') {
  return {
    ok: true,
    status: 200,
    headers: headers(contentType),
    body: {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield chunk;
      }
    }
  };
}

const calls = [];
const provider = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return streamResponse([Buffer.from('data: {"ok":true}\n\n'), Buffer.from('data: [DONE]\n\n')]);
  }
});
const stream = await provider.stream({ model: 'local:qwen2.5:7b', messages: [{ role: 'user', content: 'x' }] });
let text = '';
for await (const chunk of stream) text += chunk.toString('utf8');
assert.match(text, /\[DONE\]/);
assert.equal(calls[0].init.redirect, 'error');
assert.equal(calls[0].init.headers.Accept, 'text/event-stream');
assert.equal(JSON.parse(calls[0].init.body).stream, true);

await assert.rejects(
  createLocalOllamaProvider({ enabled: true, fetchImpl: async () => streamResponse([], 'application/json') })
    .stream({ model: 'local:qwen2.5', messages: [{ role: 'user', content: 'x' }] }),
  (error) => error?.code === 'INVALID_LOCAL_PROVIDER_RESPONSE_TYPE'
);

const oversizeChunk = Buffer.alloc(LOCAL_PROVIDER_DEFAULTS.maxStreamChunkBytes + 1);
const oversizeStream = await createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async () => streamResponse([oversizeChunk])
}).stream({ model: 'local:qwen2.5', messages: [{ role: 'user', content: 'x' }] });
await assert.rejects(async () => {
  for await (const _chunk of oversizeStream) void _chunk;
}, (error) => error?.code === 'LOCAL_PROVIDER_STREAM_CHUNK_TOO_LARGE');

const unit = Buffer.alloc(512 * 1024);
const cumulativeChunks = Array.from({ length: 17 }, () => unit);
const cumulativeStream = await createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async () => streamResponse(cumulativeChunks)
}).stream({ model: 'local:qwen2.5', messages: [{ role: 'user', content: 'x' }] });
await assert.rejects(async () => {
  for await (const _chunk of cumulativeStream) void _chunk;
}, (error) => error?.code === 'LOCAL_PROVIDER_STREAM_TOO_LARGE');

const invalidStream = await createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async () => streamResponse(['not-bytes'])
}).stream({ model: 'local:qwen2.5', messages: [{ role: 'user', content: 'x' }] });
await assert.rejects(async () => {
  for await (const _chunk of invalidStream) void _chunk;
}, (error) => error?.code === 'INVALID_LOCAL_PROVIDER_STREAM');

assert.equal(LOCAL_PROVIDER_DEFAULTS.maxStreamBytes, 8 * 1024 * 1024);
assert.equal(LOCAL_PROVIDER_DEFAULTS.maxStreamChunkBytes, 512 * 1024);
console.log('local provider stream boundary tests passed');
