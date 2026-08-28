// Sınır girdisi normalizasyonu sözleşmesi.
//
// Regresyon kaynağı: `= {}` varsayılan parametresi yalnız `undefined` için
// devreye girer. `null` geçirildiğinde connector sınırları ham `TypeError`
// fırlatıyor, kendi `INVALID_*` sözleşme hatalarını hiç üretmiyordu.

import assert from 'node:assert/strict';
import { requireObjectInput } from '../lib/boundary-input.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';

const fail = (reason) => { throw new Error(`INVALID_TEST:${reason}`); };
const returning = (reason) => new Error(`INVALID_TEST:${reason}`);

// `undefined` geriye dönük uyumluluk için boş nesneye indirgenir.
assert.deepEqual(requireObjectInput(undefined, 'input', fail), {});

// Geçerli nesne aynen korunur (kopyalanmaz).
const original = { ownerId: 'owner' };
assert.equal(requireObjectInput(original, 'input', fail), original);

// Sözleşme dışı her girdi sınırın kendi hatasını üretir; ham TypeError değil.
for (const bad of [null, 0, 42, '', 'owner', false, true, [], [1], Symbol('x')]) {
  assert.throws(() => requireObjectInput(bad, 'input', fail), /INVALID_TEST:input/);
  // `onInvalid` hatayı fırlatmak yerine döndürse de sonuç fırlatmadır.
  assert.throws(() => requireObjectInput(bad, 'input', returning), /INVALID_TEST:input/);
}

// `onInvalid` hata dışı bir değer döndürürse sessizce geçilmez.
assert.throws(() => requireObjectInput(null, 'input', () => 'oops'), /INVALID_BOUNDARY_INPUT:input/);

// --- Sınırların gerçek davranışı ---

const tokenStore = { load: async () => null };
const resolver = { resolve: () => ({ ownerId: 'owner' }) };

for (const [factory, pattern] of [
  [createGmailReadClient, /INVALID_GMAIL_READ:options/],
  [createCanvaReadClient, /INVALID_CANVA_READ:options/]
]) {
  for (const bad of [null, 42, [], 'token']) assert.throws(() => factory(bad), pattern);
}

for (const [factory, pattern] of [
  [createGmailReadToolBoundary, /INVALID_GMAIL_READ_TOOL:options/],
  [createCanvaReadToolBoundary, /INVALID_CANVA_READ_TOOL:options/],
  [createGmailSendToolBoundary, /INVALID_GMAIL_SEND_TOOL:options/]
]) {
  for (const bad of [null, 42, []]) assert.throws(() => factory(bad), pattern);
}

// İstemci `read` girdisi sözleşmeye bağlı.
for (const [factory, pattern] of [
  [createGmailReadClient, /INVALID_GMAIL_READ:request/],
  [createCanvaReadClient, /INVALID_CANVA_READ:request/]
]) {
  const client = factory({ tokenStore });
  for (const bad of [null, 42, []]) await assert.rejects(() => client.read(bad), pattern);
}

// Tool sınırlarında bozuk context sessizce varsayılana düşmez. Bu özellikle
// gönderme sınırı için önemlidir: bozuk bir context `approvalGranted: false`
// varsayımıyla devam etmek yerine sözleşme hatası üretmelidir.
const readTool = createGmailReadToolBoundary({ readClient: { read: async () => ({ ok: true }) }, ownerResolver: resolver });
const canvaTool = createCanvaReadToolBoundary({ readClient: { read: async () => ({ ok: true }) }, ownerResolver: resolver });
const sendTool = createGmailSendToolBoundary({ sendClient: { send: async () => ({ ok: true }) }, ownerResolver: resolver });

for (const [tool, args, pattern, code] of [
  [readTool, { operation: 'profile.get' }, /INVALID_GMAIL_READ_TOOL:context/, 'INVALID_GMAIL_READ_TOOL'],
  [canvaTool, { operation: 'user.get' }, /INVALID_CANVA_READ_TOOL:context/, 'INVALID_CANVA_READ_TOOL'],
  [sendTool, { to: 'a@example.com', subject: 's', body: 'b' }, /INVALID_GMAIL_SEND_TOOL:context/, 'INVALID_GMAIL_SEND_TOOL']
]) {
  for (const bad of [null, 42, []]) {
    await assert.rejects(() => tool.execute(args, bad), pattern);
  }
  // tool-runtime hata sınıflandırması `error.code` üzerinden yapılır; sözleşme
  // hatası bu alanı kaybetmemeli.
  await assert.rejects(() => tool.execute(args, null), (error) => error.code === code);
}

// `undefined` context geriye dönük uyumlu kalır (çağrı tek argümanla yapılır).
assert.deepEqual(await readTool.execute({ operation: 'profile.get' }), { ok: true });

console.log('boundary input tests passed');
