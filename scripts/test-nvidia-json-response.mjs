import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import {
  NVIDIA_JSON_RESPONSE_LIMITS,
  isJsonContentType,
  readNvidiaJsonResponse
} from '../lib/nvidia-json-response.mjs';

assert.equal(NVIDIA_JSON_RESPONSE_LIMITS.defaultMaxBytes, 4 * 1024 * 1024);
assert.equal(NVIDIA_JSON_RESPONSE_LIMITS.maxLimitBytes, 16 * 1024 * 1024);
assert.equal(NVIDIA_JSON_RESPONSE_LIMITS.defaultErrorPreviewBytes, 1200);

for (const value of ['application/json', 'application/json; charset=utf-8', 'application/problem+json']) {
  assert.equal(isJsonContentType(value), true, value);
}
for (const value of ['', 'text/plain', 'text/event-stream', 'text/json']) {
  assert.equal(isJsonContentType(value), false, value);
}

function responseFromChunks(chunks, {
  ok = true,
  status = 200,
  contentType = 'application/json',
  contentLength = null,
  onCancel = () => {}
} = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const item of chunks) controller.enqueue(item instanceof Uint8Array ? item : encoder.encode(item));
      controller.close();
    },
    cancel() {
      onCancel();
    }
  });
  const values = new Map([['content-type', contentType]]);
  if (contentLength != null) values.set('content-length', String(contentLength));
  return {
    ok,
    status,
    body,
    headers: { get: (name) => values.get(String(name).toLowerCase()) ?? null }
  };
}

{
  const value = await readNvidiaJsonResponse(responseFromChunks([
    '{"choices":[',
    '{"message":{"role":"assistant","content":"merhaba"}}',
    ']}'
  ]), { maxBytes: 4096 });
  assert.equal(value.choices[0].message.content, 'merhaba');
}

{
  const value = await readNvidiaJsonResponse(responseFromChunks(['{"ok":true}'], {
    contentType: 'application/vnd.nvidia+json; charset=utf-8'
  }), { maxBytes: 4096 });
  assert.deepEqual(value, { ok: true });
}

{
  let cancelled = 0;
  await assert.rejects(
    readNvidiaJsonResponse(responseFromChunks(['{}'], {
      contentLength: 5000,
      onCancel: () => { cancelled += 1; }
    }), { maxBytes: 1024 }),
    (error) => error?.message === 'NVIDIA_RESPONSE_TOO_LARGE' && error?.status === 502
  );
  assert.equal(cancelled, 1);
}

{
  const huge = new Uint8Array(2048).fill(65);
  await assert.rejects(
    readNvidiaJsonResponse(responseFromChunks([huge]), { maxBytes: 1024 }),
    /NVIDIA_RESPONSE_TOO_LARGE/
  );
}

{
  await assert.rejects(
    readNvidiaJsonResponse(responseFromChunks(['{"ok":true}'], { contentType: 'text/plain' }), { maxBytes: 4096 }),
    (error) => error?.message === 'INVALID_NVIDIA_RESPONSE' && error?.status === 502
  );
}

{
  await assert.rejects(
    readNvidiaJsonResponse(responseFromChunks(['not json']), { maxBytes: 4096 }),
    (error) => error?.message === 'INVALID_NVIDIA_RESPONSE'
  );
}

console.log('NVIDIA JSON response boundary: ok');
