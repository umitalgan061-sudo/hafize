// `public/typed/hafize-api.mts` — tarayıcı tarafındaki HTTP istemcisi.
//
// İstemcinin üç sözü vardır ve üçü de burada sınanır:
//   1. Adres birleştirme öngörülebilirdir (taban + yol, çift eğik çizgi yok).
//   2. Yalnızca geçici arızalar yeniden denenir; istemci hatası tekrar edilmez.
//   3. Çağıranın `AbortSignal`'ı sonsuz döngüye dönüşmez.
//
// Zamanlayıcı sahte değildir: yeniden deneme gecikmesi `retryDelay` ile
// üretildiği için testler `retry` sayısını düşük tutar ve gerçek beklemeyi
// milisaniyeler içinde bırakır.
import assert from 'node:assert/strict';
import { HafizeApiClient } from '../public/typed/hafize-api.mts';
import { HafizeApiError } from '../public/typed/hafize-types.mts';

/**
 * Çağrıları sayan ve sırayla önceden belirlenmiş yanıtları döndüren sahte
 * `fetch`. Dizinin sonuna gelindiğinde son kayıt tekrarlanır.
 *
 * @param {ReadonlyArray<Response | Error | ((input: any, init: any) => Response | Promise<Response>)>} sequence
 * @returns {((input: any, init?: any) => Promise<Response>) & { calls: Array<{ input: string; init: any }> }}
 */
function fetchDouble(sequence) {
  /** @type {Array<{ input: string; init: any }>} */
  const calls = [];
  const impl = async (input, init) => {
    calls.push({ input: String(input), init });
    const value = sequence[Math.min(calls.length - 1, sequence.length - 1)];
    if (typeof value === 'function') return value(input, init);
    if (value instanceof Error) throw value;
    return /** @type {Response} */ (value);
  };
  impl.calls = calls;
  return impl;
}

const json = (body, init) => new Response(JSON.stringify(body), init);

// --- Başarılı yanıtlar normalleştirilerek döner -----------------------------
{
  const fetchImpl = fetchDouble([
    (input) => {
      const url = String(input);
      if (url.endsWith('/api/health')) return json({ status: 'ok', nvidiaConfigured: true, agents: 2 });
      if (url.endsWith('/api/models')) return json({ models: ['a', 'b'] });
      return json({ defaultAgent: 'a', agents: [{ id: 'a', name: 'A' }] });
    }
  ]);
  const api = new HafizeApiClient('/app', fetchImpl);
  assert.equal((await api.health()).nvidiaConfigured, true);
  assert.deepEqual([...(await api.models()).models], ['a', 'b']);
  assert.equal((await api.agents()).defaultAgent, 'a');
  assert.equal(fetchImpl.calls.length, 3);
}

// --- Adres birleştirme: göreli taban ----------------------------------------
{
  const fetchImpl = fetchDouble([json({ status: 'ok', nvidiaConfigured: true })]);
  const api = new HafizeApiClient('/hafize', fetchImpl);
  await api.health();
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].input, '/hafize/api/health');
}

// --- Adres birleştirme: mutlak taban, çift eğik çizgi üretmez ---------------
{
  const fetchImpl = fetchDouble([json({ models: ['a'] })]);
  const api = new HafizeApiClient('https://example.test/', fetchImpl);
  assert.deepEqual([...(await api.models()).models], ['a']);
  assert.equal(fetchImpl.calls[0].input, 'https://example.test/api/models');
}

// --- Geçici HTTP arızası yeniden denenir ------------------------------------
{
  const fetchImpl = fetchDouble([
    json({ error: 'TEMPORARY' }, { status: 503, headers: { 'X-Hafize-Trace-Id': 'trace-a' } }),
    json({ status: 'ok', nvidiaConfigured: true })
  ]);
  const api = new HafizeApiClient('', fetchImpl);
  const result = await api.request('/api/health', { retry: 1, timeoutMs: 2000 });
  assert.equal(/** @type {any} */ (result).nvidiaConfigured, true);
  assert.equal(fetchImpl.calls.length, 2, '503 bir kez yeniden denenir');
}

// --- İstemci hatası yeniden denenmez ----------------------------------------
{
  const fetchImpl = fetchDouble([json({ error: 'INVALID_CHAT_REQUEST' }, { status: 400 })]);
  const api = new HafizeApiClient('', fetchImpl);
  await assert.rejects(
    api.health(),
    (/** @type {HafizeApiError} */ error) => {
      assert.equal(error.name, 'HafizeApiError');
      assert.equal(error.code, 'INVALID_CHAT_REQUEST');
      assert.equal(error.status, 400);
      assert.equal(error.retryable, false);
      return true;
    }
  );
  assert.equal(fetchImpl.calls.length, 1, '400 tek denemede biter');
}

// --- Yukarı akış arızasının iz kimliği korunur ------------------------------
{
  const fetchImpl = fetchDouble([json({ error: 'UPSTREAM' }, { status: 502, headers: { 'X-Hafize-Trace-Id': 'trace-xyz' } })]);
  const api = new HafizeApiClient('', fetchImpl);
  await assert.rejects(
    api.request('/api/models', { retry: 0, timeoutMs: 2000 }),
    (/** @type {HafizeApiError} */ error) => {
      assert.ok(error instanceof HafizeApiError);
      assert.equal(error.code, 'UPSTREAM');
      assert.equal(error.status, 502);
      assert.equal(error.traceId, 'trace-xyz');
      assert.equal(error.retryable, true);
      return true;
    }
  );
}

// --- Taşıma arızası yeniden denenebilir NETWORK_ERROR'a eşlenir -------------
{
  const fetchImpl = fetchDouble([new Error('socket closed')]);
  const api = new HafizeApiClient('', fetchImpl);
  await assert.rejects(
    api.request('/api/models', { retry: 1, timeoutMs: 2000 }),
    (/** @type {HafizeApiError} */ error) => {
      assert.equal(error.code, 'NETWORK_ERROR');
      assert.equal(error.retryable, true);
      return true;
    }
  );
  assert.equal(fetchImpl.calls.length, 2, 'ağ hatası bir kez yeniden denenir');
}

// --- Çağıranın iptali sonsuz yeniden denemeye dönüşmez ----------------------
{
  const controller = new AbortController();
  const fetchImpl = fetchDouble([
    (_input, init) => {
      assert.equal(init?.signal?.aborted, false, 'istek başlarken sinyal temizdir');
      controller.abort(new DOMException('test abort', 'AbortError'));
      throw init?.signal?.reason ?? new DOMException('aborted', 'AbortError');
    }
  ]);
  const api = new HafizeApiClient('', fetchImpl);
  await assert.rejects(
    api.request('/api/health', { signal: controller.signal, retry: 0, timeoutMs: 2000 }),
    (/** @type {HafizeApiError} */ error) => {
      assert.equal(error.code, 'NETWORK_ERROR');
      return true;
    }
  );
  assert.equal(fetchImpl.calls.length, 1, 'iptal edilen istek tekrarlanmaz');
}

console.log('typed API client OK: adresler öngörülebilir, yalnızca geçici arıza yeniden denenir, iptal sonsuz döngü kurmaz');
