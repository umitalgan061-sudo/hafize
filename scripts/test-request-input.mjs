import assert from 'node:assert/strict';
import { isPlainRequestObject, normalizeRequestInput } from '../lib/request-input.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { normalizeMemoryRetrieval } from '../lib/memory-retrieval-boundary.mjs';
import { createContextCompactor } from '../lib/context-compaction.mjs';
import { createGitHubReadFile, GitHubReadError } from '../lib/github-read.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';

const fail = (field) => {
  throw new Error(`INVALID_TEST:${field}`);
};

assert.equal(isPlainRequestObject({}), true);
assert.equal(isPlainRequestObject({ a: 1 }), true);
for (const value of [null, undefined, [], 'text', 0, 42, true, false]) {
  assert.equal(isPlainRequestObject(value), false);
}

// undefined, çağıranın hiç argüman vermediği hâldir ve boş nesneye indirgenir.
assert.deepEqual(normalizeRequestInput(undefined, fail), {});
const passthrough = { ownerId: 'owner_opaque' };
assert.equal(normalizeRequestInput(passthrough, fail), passthrough);
assert.equal(normalizeRequestInput({}, fail).ownerId, undefined);

// Geçersiz girişlerde dilin TypeError'ı değil, çağıranın kendi hatası döner.
for (const value of [null, [], 'text', 42, true]) {
  assert.throws(() => normalizeRequestInput(value, fail), (error) => {
    assert.equal(error instanceof TypeError, false);
    assert.match(error.message, /^INVALID_TEST:request$/);
    return true;
  });
}
assert.throws(() => normalizeRequestInput(null, fail, 'options'), /INVALID_TEST:options/);

// Fırlatmayan bir `fail` uygulaması geçersiz girişi sızdıramaz.
assert.throws(() => normalizeRequestInput(null, () => {}), /INVALID_REQUEST_INPUT:request/);
assert.throws(() => normalizeRequestInput(null, 'not-a-function'), /INVALID_REQUEST_NORMALIZER/);

// Sınır fonksiyonları: null istek artık sözleşme hatası üretir.
const accessToken = 'a'.repeat(40);
const tokenStore = { load: async () => null };
const gmail = createGmailReadClient({ tokenStore, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
const canva = createCanvaReadClient({ tokenStore, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });

for (const value of [null, [], 'text', 42]) {
  await assert.rejects(() => gmail.read(value), /INVALID_GMAIL_READ:request/);
  await assert.rejects(() => canva.read(value), /INVALID_CANVA_READ:request/);
}

// Fabrika seçenekleri de aynı sözleşmeye tabidir.
for (const value of [null, [], 'text', 42]) {
  assert.throws(() => createGmailReadClient(value), /INVALID_GMAIL_READ:options/);
  assert.throws(() => createCanvaReadClient(value), /INVALID_CANVA_READ:options/);
  assert.throws(() => createContextCompactor(value), /INVALID_CONTEXT_COMPACTOR:options/);
  assert.throws(() => createGitHubReadFile(value), (error) => {
    assert.ok(error instanceof GitHubReadError);
    assert.equal(error.code, 'INVALID_GITHUB_CONFIG');
    assert.equal(error.status, 500);
    return true;
  });
}

// Bellek sınırı hiçbir girişte fırlatmaz; her zaman {ok:false} sözleşmesi döner.
for (const value of [null, [], 'text', 42, true, {}]) {
  const result = normalizeMemoryRetrieval(value);
  assert.equal(result.ok, false);
  assert.match(result.error, /^INVALID_MEMORY_RETRIEVAL:/);
}
assert.equal(normalizeMemoryRetrieval(null).error, 'INVALID_MEMORY_RETRIEVAL:request');
assert.deepEqual(normalizeMemoryRetrieval({ ownerId: 'owner_opaque', records: [] }), {
  ok: true,
  records: []
});

// Compactor'ın ikinci argümanı da null gelebilir.
const compactor = createContextCompactor({ summarize: async () => 'özet' });
await assert.rejects(() => compactor.prepare([{ role: 'user', content: 'merhaba' }], null), /INVALID_CONTEXT_COMPACTOR:prepareOptions/);
const prepared = await compactor.prepare([{ role: 'user', content: 'merhaba' }]);
assert.equal(prepared.meta.compacted, false);
assert.equal(Array.isArray(prepared.messages), true);

// Tool boundary katmanlarının ikinci (context) argümanı principal ve
// approvalGranted taşır; geçersiz bir context sessizce yetkisiz çalışmamalıdır.
const readClient = { read: async () => ({ ok: true }) };
const sendClient = { send: async () => ({ messageId: 'm1', threadId: 't1' }) };
const ownerResolver = { resolve: () => ({ ownerId: 'owner_opaque' }) };
const boundaries = [
  [createGmailReadToolBoundary({ readClient, ownerResolver }), { operation: 'profile.get' }, /INVALID_GMAIL_READ_TOOL:context/],
  [createCanvaReadToolBoundary({ readClient, ownerResolver }), { operation: 'user.get' }, /INVALID_CANVA_READ_TOOL:context/],
  [createGmailSendToolBoundary({ sendClient, ownerResolver }), { to: 'kisi@example.com', subject: 'konu', body: 'gövde' }, /INVALID_GMAIL_SEND_TOOL:context/]
];
for (const [boundary, args, pattern] of boundaries) {
  for (const value of [null, [], 'text', 42]) {
    await assert.rejects(() => boundary.execute(args, value), pattern);
  }
}
for (const factory of [createGmailReadToolBoundary, createCanvaReadToolBoundary, createGmailSendToolBoundary]) {
  for (const value of [null, [], 'text', 42]) {
    assert.throws(() => factory(value), /^Error: INVALID_[A-Z_]+:options$/);
  }
}

// Onay bayrağı taşımayan bir context ile gönderim hâlâ kapalı kalır.
const sendBoundary = boundaries[2][0];
await assert.rejects(
  () => sendBoundary.execute(boundaries[2][1], { principal: { subject: 'owner_opaque' } }),
  (error) => {
    assert.equal(error instanceof TypeError, false);
    assert.equal(error.code, 'INVALID_GMAIL_SEND_FIELD');
    return true;
  }
);

// Geçerli akış bozulmadı: doğru istek hâlâ ağ çağrısına ulaşır.
let requestedUrl = '';
const workingGmail = createGmailReadClient({
  tokenStore: {
    load: async () => ({
      accessToken,
      tokenType: 'Bearer',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      expiresAt: 1_000_000 + 300_000
    })
  },
  fetchImpl: async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ emailAddress: 'redacted' }) };
  },
  now: () => 1_000_000
});
const profile = await workingGmail.read({ ownerId: 'owner_opaque', operation: 'profile.get' });
assert.equal(requestedUrl, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
assert.deepEqual(profile, { emailAddress: 'redacted' });

console.log('Request input OK: boundary entry points reject null/primitive requests through their own contract, not TypeError');
