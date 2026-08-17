import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/chat-run-controller.js');

function makeRoot(fetchImpl, overrides = {}) {
  return {
    fetch: fetchImpl,
    location: { origin: 'https://hafize.test' },
    TransformStream,
    TextDecoder,
    TextEncoder,
    Response,
    ...overrides
  };
}

{
  const original = async () => new Response('ok');
  const root = makeRoot(original);
  const first = api.installSseIntegrity(root);
  const installedFetch = root.fetch;
  const second = api.installSseIntegrity(root);
  assert.equal(first, second);
  assert.equal(root.fetch, installedFetch);
  first.restore();
  assert.notEqual(root.fetch, installedFetch);
  assert.equal(await (await root.fetch('/anything')).text(), 'ok');
  first.restore();
}

{
  assert.equal(api.installSseIntegrity(null), null);
  assert.equal(api.installSseIntegrity({}), null);
  assert.equal(api.installSseIntegrity({ fetch: 42 }), null);
}

{
  let requestSeen = null;
  const root = makeRoot(async (input, init) => {
    requestSeen = { input, init };
    return new Response('data: final', { headers: { 'Content-Type': 'text/event-stream' } });
  });
  api.installSseIntegrity(root);
  const marker = { opaque: true };
  const response = await root.fetch('/api/agent/run', {
    method: 'POST',
    body: '{"test":true}',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    signal: marker
  });
  assert.equal(requestSeen.input, '/api/agent/run');
  assert.equal(requestSeen.init.body, '{"test":true}');
  assert.equal(requestSeen.init.signal, marker, 'guard must not replace cancellation signal');
  assert.equal(await response.text(), 'data: final\n\n');
}

{
  const raw = new Response('data: final', { headers: { 'Content-Type': 'text/event-stream' } });
  const root = makeRoot(async () => raw, { TransformStream: undefined });
  api.installSseIntegrity(root);
  const response = await root.fetch('/api/chat', { method: 'POST' });
  assert.equal(response, raw, 'unsupported transform environments must fail open to native response');
}

{
  const raw = new Response('json', { headers: { 'Content-Type': 'application/json' } });
  const root = makeRoot(async () => raw);
  api.installSseIntegrity(root);
  const response = await root.fetch('/api/chat', { method: 'POST' });
  assert.equal(response, raw, 'non-SSE error payloads must remain untouched');
  assert.equal(await response.text(), 'json');
}

{
  const root = makeRoot(async () => {
    throw Object.assign(new Error('network down'), { code: 'NETWORK_DOWN' });
  });
  api.installSseIntegrity(root);
  await assert.rejects(
    () => root.fetch('/api/chat', { method: 'POST' }),
    (error) => error?.code === 'NETWORK_DOWN',
    'original fetch failures must propagate unchanged'
  );
}

{
  const normalizer = api.createSseFrameNormalizer();
  assert.deepEqual(normalizer.push('\r'), []);
  assert.deepEqual(normalizer.push('\n\r'), []);
  assert.deepEqual(normalizer.push('\ndata: x\r'), ['\n\n']);
  assert.deepEqual(normalizer.finish(), ['data: x\n\n']);
}

console.log('SSE stream integrity lifecycle tests passed');
