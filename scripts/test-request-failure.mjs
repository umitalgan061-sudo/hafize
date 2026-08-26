// HTTP istek hatası sınırı testleri.
//
// Regresyon: SSE akışı başladıktan sonra oluşan bir hata `sendJson` yoluna
// düşüyor, `res.setHeader` çağrısı `ERR_HTTP_HEADERS_SENT` fırlatıyor ve bu
// hata async istek işleyicisi içinde yakalanmadığı için süreç düşüyordu.
// Buradaki canlı sunucu senaryosu tam olarak bunu yeniden üretir.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { classifyRequestFailure, deliverRequestFailure } from '../lib/request-failure.mjs';

function fakeResponse({ headersSent = false, writableEnded = false, destroyed = false } = {}) {
  return {
    headersSent,
    writableEnded,
    destroyed,
    writes: [],
    ended: false,
    jsonCalls: [],
    write(chunk) {
      this.writes.push(chunk);
      return true;
    },
    end() {
      this.ended = true;
    }
  };
}

const sendJson = (res, status, payload) => {
  if (res.headersSent) throw new Error('ERR_HTTP_HEADERS_SENT');
  res.jsonCalls.push({ status, payload });
  res.headersSent = true;
  res.ended = true;
};

// --- Sınıflandırma -------------------------------------------------------

assert.deepEqual(classifyRequestFailure(new Error('BODY_TOO_LARGE')), {
  silent: false,
  status: 413,
  body: { error: 'BODY_TOO_LARGE' }
});
assert.deepEqual(classifyRequestFailure(new Error('NVIDIA_NOT_CONFIGURED')).status, 503);
assert.deepEqual(classifyRequestFailure(new SyntaxError('bad json')), {
  silent: false,
  status: 400,
  body: { error: 'INVALID_JSON' }
});

const upstream = Object.assign(new Error('NVIDIA_CHAT_ERROR'), { status: 429, detail: 'x'.repeat(4000) });
const upstreamFailure = classifyRequestFailure(upstream);
assert.equal(upstreamFailure.status, 429);
assert.equal(upstreamFailure.body.detail.length, 1200, 'detay kırpılmalı');

// Geçersiz durum kodları yukarı akıştan olduğu gibi taşınmaz.
assert.equal(classifyRequestFailure(Object.assign(new Error('NVIDIA_CHAT_ERROR'), { status: 0 })).status, 502);
assert.equal(classifyRequestFailure(Object.assign(new Error('NVIDIA_CHAT_ERROR'), { status: 200 })).status, 502);

// Bilinmeyen hatalar iç ayrıntı sızdırmaz.
const leaky = classifyRequestFailure(new Error('/home/user/secret-token-abc123 okunamadı'));
assert.deepEqual(leaky, { silent: false, status: 500, body: { error: 'INTERNAL_ERROR' } });

// İstemci koptuğunda sessiz kalınır.
for (const aborted of [
  Object.assign(new Error('aborted'), { name: 'AbortError' }),
  Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
  Object.assign(new Error('closed'), { code: 'ERR_STREAM_PREMATURE_CLOSE' })
]) {
  assert.equal(classifyRequestFailure(aborted).silent, true, aborted.message);
}

// --- Teslim yolu ---------------------------------------------------------

const fresh = fakeResponse();
assert.equal(deliverRequestFailure(fresh, new Error('BODY_TOO_LARGE'), { sendJson }), 'json');
assert.deepEqual(fresh.jsonCalls, [{ status: 413, payload: { error: 'BODY_TOO_LARGE' } }]);
assert.deepEqual(fresh.writes, []);

const streaming = fakeResponse({ headersSent: true });
assert.equal(deliverRequestFailure(streaming, new Error('boom'), { sendJson }), 'stream');
assert.deepEqual(streaming.jsonCalls, [], 'akış başladıysa JSON yolu denenmemeli');
assert.deepEqual(JSON.parse(streaming.writes[0].slice('data: '.length)), { error: 'INTERNAL_ERROR' });
assert.equal(streaming.ended, true);

const closed = fakeResponse({ writableEnded: true });
assert.equal(deliverRequestFailure(closed, new Error('boom'), { sendJson }), 'closed');
assert.deepEqual(closed.writes, []);
assert.deepEqual(closed.jsonCalls, []);

const abortedStream = fakeResponse({ headersSent: true });
assert.equal(
  deliverRequestFailure(abortedStream, Object.assign(new Error('x'), { name: 'AbortError' }), { sendJson }),
  'aborted'
);
assert.deepEqual(abortedStream.writes, [], 'kopmuş istemciye hata çerçevesi yazılmaz');
assert.equal(abortedStream.ended, true);

// Teslim yolu kendisi fırlatırsa bile hata sınırı hata üretmemeli.
const hostile = fakeResponse({ headersSent: true });
hostile.write = () => {
  throw new Error('socket kapandı');
};
assert.equal(deliverRequestFailure(hostile, new Error('boom'), { sendJson }), 'closed');
assert.equal(hostile.ended, true);

assert.throws(() => deliverRequestFailure(fakeResponse(), new Error('boom')), /INVALID_REQUEST_FAILURE:sendJson/);

// --- Canlı sunucu regresyonu --------------------------------------------
// Akış başladıktan sonra fırlatan bir işleyici: eski davranışta üst düzey
// catch `res.setHeader` çağırıp `ERR_HTTP_HEADERS_SENT` üretiyor, bu da
// yakalanmamış promise reddi olarak süreci düşürüyordu.

let unhandled = null;
process.on('unhandledRejection', (reason) => {
  unhandled = reason;
});

const server = createServer(async (req, res) => {
  try {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
    res.write('event: hafize-tool-activity\ndata: {"state":"running"}\n\n');
    throw new Error('araç akışı ortasında beklenmeyen hata');
  } catch (error) {
    deliverRequestFailure(res, error, { sendJson });
  }
});

await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const port = server.address().port;

try {
  const response = await fetch(`http://127.0.0.1:${port}/api/agent/run`, {
    signal: AbortSignal.timeout(4_000)
  });
  assert.equal(response.status, 200, 'akış başladıysa durum kodu değişmez');
  const body = await response.text();
  assert.match(body, /"error":"INTERNAL_ERROR"/);
  assert.equal(body.includes('beklenmeyen hata'), false, 'iç hata metni sızmamalı');

  // Sunucu hâlâ ayakta: sonraki istek de yanıtlanmalı.
  const second = await fetch(`http://127.0.0.1:${port}/api/agent/run`, {
    signal: AbortSignal.timeout(4_000)
  });
  assert.equal(second.status, 200);
  await second.text();
} finally {
  await new Promise((closed2) => server.close(closed2));
}

await new Promise((tick) => setTimeout(tick, 50));
assert.equal(unhandled, null, `yakalanmamış promise reddi: ${unhandled}`);

console.log('request failure boundary tests passed');
