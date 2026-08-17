import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/chat-run-controller.js');

async function readText(response) {
  return response.text();
}

{
  const encoder = new TextEncoder();
  const bytes = encoder.encode('data: {"choices":[{"delta":{"content":"İstanbul 🚀"}}]}');
  const rocketStart = bytes.findIndex((value, index) => (
    value === 0xf0 && bytes[index + 1] === 0x9f && bytes[index + 2] === 0x9a && bytes[index + 3] === 0x80
  ));
  assert.ok(rocketStart > 0, 'rocket UTF-8 sequence must exist');

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, rocketStart + 1));
      controller.enqueue(bytes.slice(rocketStart + 1, rocketStart + 3));
      controller.enqueue(bytes.slice(rocketStart + 3));
      controller.close();
    }
  });
  const response = new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  const wrapped = api.createNormalizedSseResponse(response, globalThis);
  assert.equal(
    await readText(wrapped),
    'data: {"choices":[{"delta":{"content":"İstanbul 🚀"}}]}\n\n',
    'incremental decoder must preserve split multibyte code points'
  );
}

{
  const encoder = new TextEncoder();
  const payload = [
    ': proxy keepalive\r\n\r\n',
    'event: hafize-tool-activity\r\ndata: {"label":"repo.read","state":"running"}\r\n\r\n',
    'data: {"choices":[{"delta":{"content":"tamam"}}]}\r\n\r\n',
    'data: [DONE]'
  ].join('');
  const bytes = encoder.encode(payload);
  const cuts = [1, 7, 18, 33, 64, 91, 117, bytes.length - 2];
  const chunks = [];
  let start = 0;
  for (const cut of cuts) {
    chunks.push(bytes.slice(start, cut));
    start = cut;
  }
  chunks.push(bytes.slice(start));

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
  const wrapped = api.createNormalizedSseResponse(
    new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=UTF-8' } }),
    globalThis
  );
  const output = await wrapped.text();
  assert.equal(output.includes('\r'), false, 'all CR line endings must be normalized');
  assert.equal(output.endsWith('data: [DONE]\n\n'), true, 'unterminated DONE frame must be flushed');
  assert.equal((output.match(/\n\n/g) || []).length, 4, 'all four frames must keep exact boundaries');
  assert.match(output, /event: hafize-tool-activity\ndata: \{"label":"repo\.read","state":"running"\}\n\n/);
}

{
  let cancelled = false;
  let cancelReason = null;
  const encoder = new TextEncoder();
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: first\n\n'));
      controller.enqueue(encoder.encode('data: second'));
    },
    cancel(reason) {
      cancelled = true;
      cancelReason = reason;
    }
  });
  const wrapped = api.createNormalizedSseResponse(
    new Response(source, { headers: { 'Content-Type': 'text/event-stream' } }),
    globalThis
  );
  const reader = wrapped.body.getReader();
  const first = await reader.read();
  assert.equal(new TextDecoder().decode(first.value), 'data: first\n\n');
  await reader.cancel('user-stop');
  assert.equal(cancelled, true, 'consumer cancellation must propagate to source stream');
  assert.equal(cancelReason, 'user-stop');
}

{
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: \u0000binary-like-text\n\n'));
      controller.close();
    }
  });
  const wrapped = api.createNormalizedSseResponse(
    new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
    globalThis
  );
  assert.equal(await wrapped.text(), 'data: \u0000binary-like-text\n\n', 'guard must frame text without interpreting payload');
}

{
  const normalizer = api.createSseFrameNormalizer({ maxPendingChars: 2048 });
  const frames = [];
  for (let index = 0; index < 100; index += 1) {
    frames.push(...normalizer.push(`data: ${index}\n\n`));
    assert.equal(normalizer.snapshot().pendingChars, 0, 'completed frames must not accumulate pending memory');
  }
  assert.equal(frames.length, 100);
  assert.deepEqual(normalizer.finish(), []);
}

console.log('SSE stream integrity adversarial tests passed');
