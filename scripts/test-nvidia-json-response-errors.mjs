import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import {
  normalizeMaxBytes,
  normalizePreviewBytes,
  readNvidiaJsonResponse
} from '../lib/nvidia-json-response.mjs';

for (const value of [1024, 4096, 4 * 1024 * 1024, 16 * 1024 * 1024]) {
  assert.equal(normalizeMaxBytes(value), value);
}
for (const value of [0, 1023, 16 * 1024 * 1024 + 1, 1.5, '4096', null]) {
  if (value === null) {
    assert.equal(normalizeMaxBytes(), 4 * 1024 * 1024);
    continue;
  }
  assert.throws(() => normalizeMaxBytes(value), /INVALID_NVIDIA_JSON_RESPONSE_LIMIT/);
}
for (const value of [0, 1, 1200, 4096]) assert.equal(normalizePreviewBytes(value), value);
for (const value of [-1, 4097, 1.1, '1200']) {
  assert.throws(() => normalizePreviewBytes(value), /INVALID_NVIDIA_JSON_RESPONSE_PREVIEW/);
}

function errorResponse(text, { status = 429, contentType = 'text/plain' } = {}) {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: false,
    status,
    body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
    headers: { get(name) { return String(name).toLowerCase() === 'content-type' ? contentType : null; } }
  };
}

{
  const privateDetail = 'private-provider-detail-'.repeat(100);
  await assert.rejects(
    readNvidiaJsonResponse(errorResponse(privateDetail), { maxBytes: 4096, errorPreviewBytes: 64 }),
    (error) => {
      assert.equal(error.message, 'NVIDIA_CHAT_ERROR');
      assert.equal(error.status, 429);
      assert.ok(Buffer.byteLength(error.detail, 'utf8') <= 64);
      assert.equal(error.detail.includes(privateDetail), false);
      return true;
    }
  );
}

{
  const multibyte = 'ğ'.repeat(100);
  await assert.rejects(
    readNvidiaJsonResponse(errorResponse(multibyte, { status: 503 }), { maxBytes: 4096, errorPreviewBytes: 31 }),
    (error) => {
      assert.equal(error.message, 'NVIDIA_CHAT_ERROR');
      assert.equal(error.status, 503);
      assert.ok(Buffer.byteLength(error.detail, 'utf8') <= 31);
      return true;
    }
  );
}

for (const response of [null, {}, { ok: 'yes' }, { ok: true, status: 200, body: null, headers: { get() { return 'application/json'; } } }]) {
  await assert.rejects(
    Promise.resolve().then(() => readNvidiaJsonResponse(response, { maxBytes: 4096 })),
    /INVALID_NVIDIA_RESPONSE/
  );
}

console.log('NVIDIA JSON response error policy: ok');
