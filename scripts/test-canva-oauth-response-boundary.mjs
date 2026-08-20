import assert from 'node:assert/strict';
import {
  CANVA_OAUTH_UPSTREAM_MAX_RESPONSE_BYTES,
  createCanvaOAuthUpstream,
  readCanvaOAuthJson
} from '../lib/canva-oauth-upstream.mjs';

assert.equal(CANVA_OAUTH_UPSTREAM_MAX_RESPONSE_BYTES, 64 * 1024);

function headers(values = {}) {
  return { get(name) { return values[name.toLowerCase()] || null; } };
}

function readerResponse(chunks, { contentType = 'application/json', contentLength } = {}) {
  let index = 0;
  let cancelled = 0;
  let released = 0;
  const reader = {
    async read() {
      if (index >= chunks.length) return { done: true };
      return { done: false, value: chunks[index++] };
    },
    async cancel() { cancelled += 1; },
    releaseLock() { released += 1; }
  };
  return {
    ok: true,
    status: 200,
    headers: headers({ 'content-type': contentType, ...(contentLength == null ? {} : { 'content-length': String(contentLength) }) }),
    body: { getReader() { return reader; } },
    metrics: () => ({ cancelled, released })
  };
}

{
  const response = readerResponse([new TextEncoder().encode('{"ok":true}')]);
  const payload = await readCanvaOAuthJson(response, 1024);
  assert.deepEqual(payload, { ok: true });
  assert.deepEqual(response.metrics(), { cancelled: 0, released: 1 });
}

{
  const response = readerResponse([new Uint8Array(900), new Uint8Array(200)]);
  await assert.rejects(readCanvaOAuthJson(response, 1024), (error) => error?.code === 'CANVA_OAUTH_UPSTREAM_RESPONSE_TOO_LARGE');
  assert.deepEqual(response.metrics(), { cancelled: 1, released: 1 });
}

{
  const response = readerResponse([new TextEncoder().encode('{bad')]);
  await assert.rejects(readCanvaOAuthJson(response, 1024), (error) => error?.code === 'CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE');
  assert.deepEqual(response.metrics(), { cancelled: 0, released: 1 }, 'fully consumed malformed JSON releases the reader');
}

{
  const response = readerResponse([], { contentType: 'text/html' });
  await assert.rejects(readCanvaOAuthJson(response, 1024), (error) => error?.code === 'CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE');
}

{
  const response = readerResponse([], { contentLength: 2048 });
  await assert.rejects(readCanvaOAuthJson(response, 1024), (error) => error?.code === 'CANVA_OAUTH_UPSTREAM_RESPONSE_TOO_LARGE');
}

{
  const client = createCanvaOAuthUpstream({
    maxResponseBytes: 1024,
    fetchImpl: async () => readerResponse([new TextEncoder().encode(JSON.stringify({ access_token: 'x' }))])
  });
  const result = await client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', json: true
  });
  assert.deepEqual(result.payload, { access_token: 'x' });
}

{
  const client = createCanvaOAuthUpstream({
    maxResponseBytes: 1024,
    fetchImpl: async () => ({
      ok: true, status: 200,
      headers: headers({ 'content-type': 'application/json' }),
      async json() { return { value: 'x'.repeat(2048) }; }
    })
  });
  await assert.rejects(client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', json: true
  }), (error) => error?.code === 'CANVA_OAUTH_UPSTREAM_RESPONSE_TOO_LARGE');
}

{
  assert.throws(() => createCanvaOAuthUpstream({ fetchImpl: async () => ({}), maxResponseBytes: 1023 }), /INVALID_CANVA_OAUTH_UPSTREAM:maxResponseBytes/);
  assert.throws(() => createCanvaOAuthUpstream({ fetchImpl: async () => ({}), maxResponseBytes: 256 * 1024 + 1 }), /INVALID_CANVA_OAUTH_UPSTREAM:maxResponseBytes/);
}

console.log('canva oauth response boundary tests passed');
