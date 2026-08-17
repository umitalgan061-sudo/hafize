import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/chat-run-controller.js');

function streamFrom(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
}

async function textOf(response) {
  return response.text();
}

{
  const response = new Response(streamFrom([
    'data: {"choices":[{"delta":{"content":"A"}}]}\r',
    '\n\r\ndata: {"choices":[{"delta":{"content":"B"}}]}'
  ]), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' }
  });
  const wrapped = api.createNormalizedSseResponse(response, globalThis);
  assert.notEqual(wrapped, response);
  assert.equal(wrapped.status, 200);
  assert.equal(wrapped.headers.get('cache-control'), 'no-store');
  assert.equal(await textOf(wrapped), [
    'data: {"choices":[{"delta":{"content":"A"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"B"}}]}',
    '',
    ''
  ].join('\n'));
}

{
  const response = new Response('plain', { headers: { 'Content-Type': 'application/json' } });
  assert.equal(api.createNormalizedSseResponse(response, globalThis), response);
}

{
  const response = new Response(null, { status: 204, headers: { 'Content-Type': 'text/event-stream' } });
  assert.equal(api.createNormalizedSseResponse(response, globalThis), response);
}

{
  const calls = [];
  const root = {
    fetch: async (input, init) => {
      calls.push({ input, init });
      return new Response(streamFrom(['data: {"ok":true}']), {
        headers: { 'Content-Type': 'text/event-stream' }
      });
    },
    location: { origin: 'https://hafize.test' },
    TransformStream,
    TextDecoder,
    TextEncoder,
    Response
  };
  const controller = api.installSseIntegrity(root);
  assert.ok(controller);
  const sameController = api.installSseIntegrity(root);
  assert.equal(sameController, controller, 'install must be idempotent');

  const response = await root.fetch('/api/chat', {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
    signal: AbortSignal.timeout(5000)
  });
  assert.equal(await response.text(), 'data: {"ok":true}\n\n');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, '/api/chat');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.signal instanceof AbortSignal, true, 'guard must preserve caller signal');

  controller.restore();
  assert.equal(root.fetch, controller.originalFetch);
}

{
  let counter = 0;
  const root = {
    fetch: async () => {
      counter += 1;
      return new Response(streamFrom(['data: no-final-delimiter']), {
        headers: { 'Content-Type': 'text/event-stream' }
      });
    },
    location: { origin: 'https://hafize.test' },
    TransformStream,
    TextDecoder,
    TextEncoder,
    Response
  };
  api.installSseIntegrity(root);
  const external = await root.fetch('https://example.com/api/chat', { method: 'POST' });
  assert.equal(await external.text(), 'data: no-final-delimiter', 'external requests must pass through unchanged');
  const lookalike = await root.fetch('/api/chat?debug=1', { method: 'POST' });
  assert.equal(await lookalike.text(), 'data: no-final-delimiter', 'query variants must pass through unchanged');
  const getRequest = await root.fetch('/api/chat', { method: 'GET' });
  assert.equal(await getRequest.text(), 'data: no-final-delimiter', 'non-POST requests must pass through unchanged');
  assert.equal(counter, 3);
}

{
  const root = {
    fetch: async () => new Response(streamFrom(['x'.repeat(1025)]), {
      headers: { 'Content-Type': 'text/event-stream' }
    }),
    location: { origin: 'https://hafize.test' },
    TransformStream,
    TextDecoder,
    TextEncoder,
    Response
  };
  const response = await api.createNormalizedSseResponse(
    await root.fetch('/api/chat', { method: 'POST' }),
    root,
    { maxPendingChars: 1024 }
  );
  await assert.rejects(() => response.text(), /SSE_FRAME_TOO_LARGE/);
}

console.log('SSE stream integrity response tests passed');
