import assert from 'node:assert/strict';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';
import { normalizeGmailSendRequest } from '../lib/gmail-send-contract.mjs';

// Bir connector sınırına null/geçersiz argüman verildiğinde sözleşme hatası
// dönmeli; ham TypeError sızmamalı. Ham TypeError'un `code` alanı yoktur ve
// tool-runtime tarafından spesifik doğrulama hatası yerine genel
// TOOL_EXECUTION_FAILED olarak raporlanır; mesajı da iç yapıyı açığa vurur.
const NON_OBJECTS = [null, 'string', 42, true, []];

async function rejectsContract(label, fn, pattern) {
  await assert.rejects(fn, (error) => {
    assert.ok(!(error instanceof TypeError), `${label}: ham TypeError sızdı — ${error.message}`);
    assert.match(error.message, pattern, `${label}: beklenmeyen hata — ${error.message}`);
    return true;
  });
}

function throwsContract(label, fn, pattern) {
  assert.throws(fn, (error) => {
    assert.ok(!(error instanceof TypeError), `${label}: ham TypeError sızdı — ${error.message}`);
    assert.match(error.message, pattern, `${label}: beklenmeyen hata — ${error.message}`);
    return true;
  });
}

const accessToken = 'gmail-access-token-value';
const now = 1_700_000_000_000;
const tokenRecord = (scope) => ({
  accessToken,
  tokenType: 'Bearer',
  scopes: [scope],
  expiresAt: now + 300_000
});
const okFetch = async () => ({ ok: true, json: async () => ({ emailAddress: 'a@b.example' }) });

// 1. Read client'ları: factory ve read() null argümanına karşı korumalı.
for (const [label, factory, scope, pattern] of [
  ['gmail', createGmailReadClient, 'https://www.googleapis.com/auth/gmail.readonly', /INVALID_GMAIL_READ/],
  ['canva', createCanvaReadClient, 'profile:read', /INVALID_CANVA_READ/]
]) {
  for (const input of NON_OBJECTS) {
    throwsContract(`${label} factory(${JSON.stringify(input)})`, () => factory(input), pattern);
  }
  throwsContract(`${label} factory unknown option`, () => factory({ tokenStore: { load: async () => null }, nope: 1 }), pattern);

  const client = factory({
    tokenStore: { load: async () => tokenRecord(scope) },
    fetchImpl: okFetch,
    now: () => now
  });
  for (const input of NON_OBJECTS) {
    await rejectsContract(`${label} read(${JSON.stringify(input)})`, () => client.read(input), pattern);
  }
  // Bilinmeyen alan taşıyan istek de reddedilir (least privilege).
  await rejectsContract(
    `${label} read unknown field`,
    () => client.read({ ownerId: 'owner_opaque', operation: 'profile.get', extra: 'x' }),
    pattern
  );
}

// 2. Read tool boundary'leri: null bağımlılık ve null context.
for (const [label, factory, operation, pattern] of [
  ['gmail', createGmailReadToolBoundary, 'profile.get', /INVALID_GMAIL_READ_TOOL/],
  ['canva', createCanvaReadToolBoundary, 'user.get', /INVALID_CANVA_READ_TOOL/]
]) {
  for (const input of NON_OBJECTS) {
    throwsContract(`${label} boundary factory(${JSON.stringify(input)})`, () => factory(input), pattern);
  }
  let seenPrincipal = 'unset';
  const boundary = factory({
    readClient: { read: async (request) => ({ ok: true, request }) },
    ownerResolver: {
      resolve: (principal) => {
        seenPrincipal = principal;
        return { ownerId: 'owner_opaque' };
      }
    }
  });
  for (const input of NON_OBJECTS) {
    await rejectsContract(`${label} boundary execute context=${JSON.stringify(input)}`, () => boundary.execute({ operation }, input), pattern);
  }
  // Context verilmediğinde principal undefined kalır; çağrı sessizce
  // başkasının kimliğine düşmez, owner resolver karar verir.
  const result = await boundary.execute({ operation });
  assert.equal(seenPrincipal, undefined);
  assert.equal(result.request.ownerId, 'owner_opaque');
}

// 3. Gmail send: onay bağlamı null ise fail-closed davranmalı.
const sendBoundary = createGmailSendToolBoundary({
  sendClient: { send: async () => ({ messageId: 'sent-message-id' }) },
  ownerResolver: { resolve: () => ({ ownerId: 'owner_opaque' }) }
});
const validSend = {
  to: ['someone@example.com'],
  subject: 'Konu',
  text: 'Gövde',
  explicitUserIntent: true
};
for (const input of NON_OBJECTS) {
  await rejectsContract(`send boundary context=${JSON.stringify(input)}`, () => sendBoundary.execute(validSend, input), /INVALID_GMAIL_SEND_TOOL/);
}
// Context hiç verilmezse onay yok sayılır: gönderim yapılmaz.
await rejectsContract('send boundary context yok', () => sendBoundary.execute(validSend), /GMAIL_SEND_APPROVAL_REQUIRED/);
await rejectsContract(
  'send boundary onaysız',
  () => sendBoundary.execute(validSend, { principal: { id: 'p' }, approvalGranted: false }),
  /GMAIL_SEND_APPROVAL_REQUIRED/
);
// Onay verildiğinde normal akış korunur (regresyon koruması).
const receipt = await sendBoundary.execute(validSend, { principal: { id: 'p' }, approvalGranted: true });
assert.deepEqual(receipt, { sent: true, messageId: 'sent-message-id' });

for (const input of NON_OBJECTS) {
  throwsContract(
    `normalizeGmailSendRequest options=${JSON.stringify(input)}`,
    () => normalizeGmailSendRequest(validSend, input),
    /INVALID_GMAIL_SEND_OPTIONS/
  );
}
throwsContract(
  'normalizeGmailSendRequest options yok',
  () => normalizeGmailSendRequest(validSend),
  /GMAIL_SEND_APPROVAL_REQUIRED/
);

console.log('Connector null-input boundary OK: read client, read/send tool boundary ve send contract null argümanlarda sözleşme hatası döndürüyor, ham TypeError sızmıyor');
