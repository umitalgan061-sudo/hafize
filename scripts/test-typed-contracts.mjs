// `public/typed/hafize-types.mts` — HTTP sınırından gelen yükün normalleştirilmesi.
//
// Sunucu yanıtı güvenilmeyen veridir: alanlar eksik, yanlış tipte veya bilerek
// şişirilmiş olabilir. Bu paket, ayrıştırıcıların hiçbir koşulda atmadığını ve
// her alanın sınırlı ve doğru tipte döndüğünü doğrular.
//
// Denetlenen modül TypeScript'tir ve doğrudan yüklenir: Node 22.18+ tipleri
// sıyırır, bu yüzden paket `public/typed-build/` çıktısına değil kaynağa bakar.
import assert from 'node:assert/strict';
import {
  HafizeApiError,
  connectivityFromHealth,
  parseAgents,
  parseHealth,
  parseModels
} from '../public/typed/hafize-types.mts';

// --- Ajan listesi: bozuk kayıtlar sessizce düşer, sağlamlar korunur ---------
{
  const parsed = parseAgents({
    defaultAgent: 'assistant',
    agents: [
      { id: 'assistant', name: 'Hafize', description: 'main', tools: ['github', 4, null] },
      { id: 4, name: 'invalid' },
      null,
      'invalid'
    ]
  });
  assert.equal(parsed.defaultAgent, 'assistant');
  assert.deepEqual(parsed.agents, [{ id: 'assistant', name: 'Hafize', description: 'main', tools: ['github'] }]);
}

// --- Model listesi: yalnızca dizeler, sıra korunur, sayı sınırlı ------------
{
  const models = Array.from({ length: 230 }, (_, index) => (index === 4 ? 42 : `model-${index}`));
  const parsed = parseModels({ models });
  assert.equal(parsed.models.length, 200);
  assert.equal(parsed.models.includes('42'), false);
  assert.equal(parsed.models.includes(/** @type {any} */ (42)), false);
  assert.equal(parsed.models[0], 'model-0');
}
{
  const parsed = parseModels({ models: ['z', null, 'a', 3, 'b', ...Array.from({ length: 220 }, (_, i) => `m-${i}`)] });
  assert.equal(parsed.models[0], 'z', 'sıra korunur');
  assert.equal(parsed.models[1], 'a');
  assert.equal(parsed.models[2], 'b');
  assert.equal(parsed.models.length, 200);
}

// --- Sağlık yükü: yanlış tipler güvenli varsayılana düşer -------------------
{
  const parsed = parseHealth({ status: 500, nvidiaConfigured: 'yes', scheduleStorageDurable: true, agents: -3 });
  assert.equal(parsed.status, 'unknown', 'sayısal status metin sayılmaz');
  assert.equal(parsed.nvidiaConfigured, false, "'yes' dizesi true değildir");
  assert.equal(parsed.scheduleStorageDurable, true);
  assert.equal(parsed.agents, 0, 'negatif sayaç sıfırlanır');
  assert.equal(connectivityFromHealth(parsed, true), 'degraded');
}

// Nesne olmayan hiçbir değer atmaz.
for (const value of [null, undefined, false, 0, 'health', []]) {
  assert.doesNotThrow(() => parseHealth(value), `parseHealth(${JSON.stringify(value)}) atmaz`);
  assert.equal(parseHealth(value).status, 'unknown');
}

// --- Bağlanabilirlik: önce yerel ağ durumu, sonra sunucu sağlığı ------------
{
  const health = parseHealth({ status: 'ok', nvidiaConfigured: true });
  assert.equal(connectivityFromHealth(health, false), 'offline', 'tarayıcı çevrimdışıysa sunucu sorulmaz');
  assert.equal(connectivityFromHealth(null, true), 'unknown');
  assert.equal(connectivityFromHealth(health, true), 'online');
}
{
  const health = parseHealth({ status: 'ok', nvidiaConfigured: false, agents: 2 });
  assert.equal(connectivityFromHealth(health, true), 'degraded', 'NVIDIA yoksa çevrimiçi değil, kısıtlı');
}

// --- Normalleştirme yükün fazladan alanlarını dışarı sızdırmaz --------------
{
  const health = parseHealth({ status: 'ok', nvidiaConfigured: true, token: 'secret-should-not-leak', apiKey: 'private' });
  assert.equal(Object.keys(health).includes('token'), false);
  assert.equal(Object.keys(health).includes('apiKey'), false);
}

// --- Düşman yük: prototip benzeri ve şişirilmiş alanlar kırpılır ------------
{
  const parsed = parseAgents({
    defaultAgent: '__proto__',
    agents: [{ id: 'a'.repeat(500), name: 'b'.repeat(500), description: 'c'.repeat(500), tools: Array(200).fill('tool') }]
  });
  // `__proto__` yalnızca bir dizedir: sonuç donmuş düz bir nesnenin alanına
  // yazıldığı için prototip kirletemez, bu yüzden reddedilmesi değil veri
  // olarak taşınması beklenir.
  assert.equal(parsed.defaultAgent, '__proto__');
  assert.ok(parsed.defaultAgent.length <= 160);
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
  assert.equal(parsed.agents[0]?.id.length, 160);
  assert.equal(parsed.agents[0]?.name.length, 160);
  assert.equal(parsed.agents[0]?.description?.length, 320);
  assert.equal(parsed.agents[0]?.tools?.length, 64);
  assert.equal(Object.getPrototypeOf(parsed.agents[0]) === Object.prototype || Object.getPrototypeOf(parsed.agents[0]) === null, true);
}

// --- Hata şekli: kod, durum, iz kimliği ve yeniden denenebilirlik açıktır ---
{
  const error = new HafizeApiError('rate limited', { code: 'RATE_LIMITED', status: 429, traceId: 'trace-123', retryable: true });
  assert.equal(error.name, 'HafizeApiError');
  assert.equal(error.code, 'RATE_LIMITED');
  assert.equal(error.status, 429);
  assert.equal(error.traceId, 'trace-123');
  assert.equal(error.retryable, true);
  assert.ok(error instanceof Error);
}

console.log('typed contracts OK: bozuk yükler güvenli varsayılana düşer, alanlar sınırlı kalır');
