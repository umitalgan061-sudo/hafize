// Sınır sözleşmesi: dışarıdan gelen istek nesnesini alan her modül, geçersiz
// girdiyi kontrollü bir `INVALID_*` hatasıyla reddetmelidir.
//
// Neden: bu fonksiyonlar `function f({ a, b } = {})` kalıbını kullanıyordu.
// Varsayılan parametre yalnızca `undefined` için devreye girer; `null` veya
// ilkel bir değer geldiğinde destructuring ham `TypeError` fırlatır. server.mjs
// bilinmeyen hataları `500 INTERNAL_ERROR` olarak eşlediği için hatalı istemci
// girdisi sunucu arızası gibi raporlanıyordu. Ayrıca beklenmeyen alanlar
// sessizce yok sayılıyordu.

import assert from 'node:assert/strict';

const CLIENT_ID = 'client'.padEnd(20, '0');
const CLIENT_SECRET = 'secret'.padEnd(20, '0');
const tokenStore = { load: async () => null, save: async () => {}, delete: async () => {} };
const fetchImpl = async () => ({ ok: true, json: async () => ({}) });

const { createCanvaReadClient } = await import('../lib/canva-read-client.mjs');
const { createGmailReadClient } = await import('../lib/gmail-read-client.mjs');
const { createCanvaTokenExchange } = await import('../lib/canva-token-exchange.mjs');
const { createCanvaTokenRefresh } = await import('../lib/canva-token-refresh.mjs');
const { createGoogleTokenExchange } = await import('../lib/google-token-exchange.mjs');
const { normalizeMemoryRetrieval } = await import('../lib/memory-retrieval-boundary.mjs');

const oauthDeps = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, tokenStore, fetchImpl };

const BOUNDARIES = [
  {
    name: 'canva-read-client.read',
    code: /INVALID_CANVA_READ/,
    call: (input) => createCanvaReadClient({ tokenStore, fetchImpl }).read(input),
    unknownKey: { ownerId: 'owner_opaque', operation: 'profile.get', url: 'https://evil.example' }
  },
  {
    name: 'gmail-read-client.read',
    code: /INVALID_GMAIL_READ/,
    call: (input) => createGmailReadClient({ tokenStore, fetchImpl }).read(input),
    unknownKey: { ownerId: 'owner_opaque', operation: 'profile.get', url: 'https://evil.example' }
  },
  {
    name: 'canva-token-exchange.exchange',
    code: /INVALID_CANVA_TOKEN_EXCHANGE/,
    call: (input) => createCanvaTokenExchange(oauthDeps).exchange(input),
    unknownKey: { ownerId: 'owner_opaque', code: 'c', verifier: 'v', scope: 'extra' }
  },
  {
    name: 'canva-token-refresh.refresh',
    code: /INVALID_CANVA_TOKEN_REFRESH/,
    call: (input) => createCanvaTokenRefresh(oauthDeps).refresh(input),
    unknownKey: { ownerId: 'owner_opaque', scope: 'extra' }
  },
  {
    name: 'google-token-exchange.exchange',
    code: /INVALID_GOOGLE_TOKEN_EXCHANGE/,
    call: (input) => createGoogleTokenExchange(oauthDeps).exchange(input),
    unknownKey: { ownerId: 'owner_opaque', code: 'c', verifier: 'v', scope: 'extra' }
  },
  {
    name: 'memory-retrieval-boundary.normalizeMemoryRetrieval',
    code: /INVALID_MEMORY_RETRIEVAL/,
    call: async (input) => normalizeMemoryRetrieval(input),
    unknownKey: null
  }
];

// Geçersiz istek gövdeleri: hiçbiri ham TypeError üretmemeli.
const INVALID_REQUESTS = [null, 'string', 42, true, [], () => {}];

for (const boundary of BOUNDARIES) {
  for (const input of INVALID_REQUESTS) {
    let thrown = null;
    try {
      await boundary.call(input);
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown, `${boundary.name}: ${JSON.stringify(String(input))} reddedilmedi`);
    assert.equal(
      thrown instanceof TypeError,
      false,
      `${boundary.name}: ham TypeError sızdırdı — ${thrown.message}`
    );
    assert.match(thrown.message, boundary.code, `${boundary.name}: beklenmeyen hata kodu`);
  }

  // Beklenmeyen alanlar sessizce yok sayılmamalı.
  if (boundary.unknownKey) {
    await assert.rejects(() => boundary.call(boundary.unknownKey), boundary.code, boundary.name);
  }
}

console.log(`request boundary contract tests passed (${BOUNDARIES.length} sınır)`);
