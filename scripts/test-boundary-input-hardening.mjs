// Connector sınırlarının null/dizi/skaler girdilerde ham TypeError yerine
// sözleşmeli INVALID_* hatası üretmesini doğrular.
//
// Neden: `function f({ a } = {})` imzasındaki varsayılan yalnız `undefined`
// için çalışır. `null` veya `42` gibi bir girdi destructuring sırasında
// TypeError fırlatır; bu hata sözleşme dışıdır, çağıranın hata sınıflandırması
// tarafından "geçersiz istek" olarak tanınmaz ve iç uygulama detayını sızdırır.
import assert from 'node:assert/strict';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createCanvaTokenExchange } from '../lib/canva-token-exchange.mjs';
import { createCanvaTokenRefresh } from '../lib/canva-token-refresh.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';

const NON_OBJECT_INPUTS = [null, 0, 42, '', 'owner', true, [], () => {}];

const tokenStore = {
  load: async () => ({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    scopes: [],
    expiresAt: Date.now() + 300_000
  }),
  save: async () => {},
  remove: async () => {},
  delete: async () => {}
};

const neverCalled = () => {
  throw new Error('BOUNDARY_LEAKED_CALL');
};

async function assertContractError(fn, pattern, label) {
  await assert.rejects(
    fn,
    (error) => {
      assert.ok(
        !(error instanceof TypeError),
        `${label}: sözleşme hatası yerine TypeError alındı -> ${error.message}`
      );
      assert.match(error.message, pattern, `${label}: beklenmeyen hata mesajı -> ${error.message}`);
      return true;
    },
    label
  );
}

// 1. Okuma istemcileri: istek gövdesi nesne değilse sözleşme hatası.
const canvaRead = createCanvaReadClient({ tokenStore, fetchImpl: neverCalled });
const gmailRead = createGmailReadClient({ tokenStore, fetchImpl: neverCalled });
for (const input of NON_OBJECT_INPUTS) {
  await assertContractError(
    () => canvaRead.read(input),
    /^INVALID_CANVA_READ:/,
    `canvaRead.read(${JSON.stringify(input) ?? typeof input})`
  );
  await assertContractError(
    () => gmailRead.read(input),
    /^INVALID_GMAIL_READ:/,
    `gmailRead.read(${JSON.stringify(input) ?? typeof input})`
  );
}

// 2. Token akışları: aynı sözleşme, ağ çağrısına ulaşmadan reddedilir.
const exchange = createCanvaTokenExchange({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenStore,
  fetchImpl: neverCalled
});
const refresh = createCanvaTokenRefresh({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenStore,
  fetchImpl: neverCalled
});
for (const input of NON_OBJECT_INPUTS) {
  await assertContractError(() => exchange.exchange(input), /^INVALID_CANVA_TOKEN_EXCHANGE:/, 'exchange');
  await assertContractError(() => refresh.refresh(input), /^INVALID_CANVA_TOKEN_REFRESH:/, 'refresh');
}

// 3. Tool boundary'leri: execution context nesne değilse istek reddedilir ve
// alt istemciye hiç ulaşmaz.
const ownerResolver = { resolve: () => ({ ownerId: 'owner_opaque' }) };
const canvaBoundary = createCanvaReadToolBoundary({
  readClient: { read: neverCalled },
  ownerResolver
});
const gmailBoundary = createGmailReadToolBoundary({
  readClient: { read: neverCalled },
  ownerResolver
});
const sendBoundary = createGmailSendToolBoundary({
  sendClient: { send: neverCalled },
  ownerResolver
});
const sendArgs = {
  to: ['someone@example.com'],
  subject: 'konu',
  text: 'gövde',
  explicitUserIntent: true
};
for (const context of NON_OBJECT_INPUTS) {
  await assertContractError(
    () => canvaBoundary.execute({ operation: 'user.get' }, context),
    /^INVALID_CANVA_READ_TOOL:context$/,
    'canvaBoundary.execute context'
  );
  await assertContractError(
    () => gmailBoundary.execute({ operation: 'profile.get' }, context),
    /^INVALID_GMAIL_READ_TOOL:context$/,
    'gmailBoundary.execute context'
  );
  await assertContractError(
    () => sendBoundary.execute(sendArgs, context),
    /^INVALID_GMAIL_SEND_TOOL:context$/,
    'sendBoundary.execute context'
  );
}

// 4. Geçersiz context, gönderme onayını asla "verilmiş" saymaz: context
// atlandığında istek onaysız kalır ve gönderim gerçekleşmez.
await assert.rejects(() => sendBoundary.execute(sendArgs), (error) => {
  assert.ok(!(error instanceof TypeError));
  assert.equal(error.message.includes('BOUNDARY_LEAKED_CALL'), false, 'onaysız gönderim alt istemciye ulaştı');
  return true;
});

// 5. Geçerli girdi hâlâ çalışır: sertleştirme mevcut davranışı bozmaz.
const okBoundary = createGmailReadToolBoundary({
  readClient: { read: async (request) => ({ echoed: request.operation, owner: request.ownerId }) },
  ownerResolver
});
assert.deepEqual(await okBoundary.execute({ operation: 'profile.get' }, { principal: { ownerId: 'owner_opaque' } }), {
  echoed: 'profile.get',
  owner: 'owner_opaque'
});

console.log('boundary input hardening tests passed');
