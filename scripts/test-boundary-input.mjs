import assert from 'node:assert/strict';
import { isRecordInput, optionalRecordInput, requireRecordInput } from '../lib/boundary-input.mjs';
import { createContextCompactor } from '../lib/context-compaction.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';
import { normalizeMemoryRetrieval } from '../lib/memory-retrieval-boundary.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createCanvaTokenExchange } from '../lib/canva-token-exchange.mjs';
import { createCanvaTokenRefresh } from '../lib/canva-token-refresh.mjs';
import { createCanvaTokenRevoke } from '../lib/canva-token-revoke.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createGoogleTokenExchange } from '../lib/google-token-exchange.mjs';

for (const value of [{}, { a: 1 }, Object.create(null)]) assert.equal(isRecordInput(value), true);
for (const value of [null, undefined, [], 'x', 0, false, 7n, Symbol('x')]) assert.equal(isRecordInput(value), false);

const throwingFail = (field) => { throw new Error(`INVALID_MODULE:${field}`); };
const returningFail = (field) => new Error(`INVALID_MODULE:${field}`);

assert.deepEqual(requireRecordInput(undefined, throwingFail), {});
assert.equal(Object.isFrozen(requireRecordInput(undefined, throwingFail)), true);
const passthrough = { ownerId: 'owner' };
assert.equal(requireRecordInput(passthrough, throwingFail), passthrough);

for (const bad of [null, [], 'x', 0, false]) {
  assert.throws(() => requireRecordInput(bad, throwingFail), /INVALID_MODULE:input/);
  assert.throws(() => requireRecordInput(bad, returningFail), /INVALID_MODULE:input/);
  assert.throws(() => requireRecordInput(bad, returningFail, 'options'), /INVALID_MODULE:options/);
  assert.throws(() => requireRecordInput(bad, null), /INVALID_BOUNDARY_INPUT:input/);
  assert.throws(() => requireRecordInput(bad, () => 'not-an-error'), /INVALID_BOUNDARY_INPUT:input/);
}

assert.deepEqual(optionalRecordInput(undefined), {});
assert.equal(optionalRecordInput(passthrough), passthrough);
for (const bad of [null, [], 'x', 0, false]) assert.equal(optionalRecordInput(bad), null);

// Sınır giriş noktaları geçersiz girişte ham TypeError yerine kendi hata sözleşmelerini korumalı.
const clientId = 'c'.repeat(24);
const clientSecret = 's'.repeat(24);
const tokenStore = { async load() { return null; }, async save() {}, async remove() { return { deleted: true }; } };
const fetchImpl = async () => ({ ok: true, async json() { return {}; } });
const readClient = { async read() { return {}; } };
const ownerResolver = { resolve: () => ({ ownerId: 'owner_opaque' }) };

const entryPoints = [
  ['gmail read client', /INVALID_GMAIL_READ:input/, (bad) => createGmailReadClient({ tokenStore, fetchImpl }).read(bad)],
  ['canva read client', /INVALID_CANVA_READ:input/, (bad) => createCanvaReadClient({ tokenStore, fetchImpl }).read(bad)],
  [
    'canva token exchange',
    /INVALID_CANVA_TOKEN_EXCHANGE:input/,
    (bad) => createCanvaTokenExchange({ clientId, clientSecret, tokenStore, fetchImpl }).exchange(bad)
  ],
  [
    'canva token refresh',
    /INVALID_CANVA_TOKEN_REFRESH:input/,
    (bad) => createCanvaTokenRefresh({ clientId, clientSecret, tokenStore, fetchImpl }).refresh(bad)
  ],
  [
    'canva token revoke',
    /INVALID_CANVA_TOKEN_REVOKE:input/,
    (bad) => createCanvaTokenRevoke({ clientId, clientSecret, tokenStore, fetchImpl }).revoke(bad)
  ],
  [
    'google token exchange',
    /INVALID_GOOGLE_TOKEN_EXCHANGE:input/,
    (bad) => createGoogleTokenExchange({ clientId, clientSecret, tokenStore, fetchImpl }).exchange(bad)
  ],
  [
    'gmail read tool boundary options',
    /INVALID_GMAIL_READ_TOOL:options/,
    (bad) => createGmailReadToolBoundary({ readClient, ownerResolver }).execute({ operation: 'profile.get' }, bad)
  ],
  [
    'canva read tool boundary options',
    /INVALID_CANVA_READ_TOOL:options/,
    (bad) => createCanvaReadToolBoundary({ readClient, ownerResolver }).execute({ operation: 'user.get' }, bad)
  ],
  [
    'gmail send tool boundary options',
    /INVALID_GMAIL_SEND_TOOL:options/,
    (bad) => createGmailSendToolBoundary({ sendClient: { send: async () => ({ messageId: 'm1' }) }, ownerResolver })
      .execute({ to: ['a@example.com'], subject: 's', text: 't', explicitUserIntent: true }, bad)
  ],
  [
    'context compactor options',
    /INVALID_CONTEXT_COMPACTOR:options/,
    (bad) => createContextCompactor({ summarize: async () => 'özet' })
      .prepare([{ role: 'user', content: 'merhaba' }], bad)
  ]
];

for (const [label, pattern, call] of entryPoints) {
  for (const bad of [null, [], 'owner', 42]) {
    await assert.rejects(() => call(bad), (error) => {
      assert.equal(error instanceof TypeError, false, `${label} ham TypeError fırlatmamalı`);
      assert.match(error.message, pattern, label);
      return true;
    });
  }
}

// Eksik argüman (undefined) hâlâ alan bazlı doğrulamaya düşer, sözleşme kodunu korur.
await assert.rejects(() => createGmailReadClient({ tokenStore, fetchImpl }).read(), /INVALID_GMAIL_READ:ownerId/);
await assert.rejects(() => createCanvaReadClient({ tokenStore, fetchImpl }).read(), /INVALID_CANVA_READ:ownerId/);
await assert.rejects(
  () => createCanvaTokenRevoke({ clientId, clientSecret, tokenStore, fetchImpl }).revoke(),
  /INVALID_CANVA_TOKEN_REVOKE:ownerId/
);

// Sonuç nesnesi döndüren sınırlar hata fırlatmaz; kendi hata kodlarını döndürür.
for (const bad of [null, [], 'owner', 42]) {
  assert.deepEqual(normalizeMemoryRetrieval(bad), { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:input' });
}
assert.deepEqual(normalizeMemoryRetrieval(), { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:ownerId' });

const scheduleStore = {
  async add() { return {}; },
  async read() { return null; },
  async snapshot() { return { entries: [] }; },
  async cancel() { return null; }
};
const scheduleBoundary = createScheduleCommandBoundary({
  store: scheduleStore,
  registry: { agents: [{ id: 'hafize-general' }] },
  createTraceId: () => 'trace-1'
});
for (const bad of [null, [], 'owner', 42]) {
  for (const method of ['create', 'list', 'cancel']) {
    assert.deepEqual(await scheduleBoundary[method](bad), { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
  }
}
// Argümansız çağrı hâlâ kimlik doğrulama kontrolüne düşer.
assert.deepEqual(await scheduleBoundary.list(), { ok: false, error: 'AUTH_REQUIRED' });

// Sağlıklı yol korunur: tool boundary options'sız çağrılabilir ve principal çözümlenir.
const resolved = [];
const boundary = createGmailReadToolBoundary({
  readClient: { async read(args) { resolved.push(args); return { ok: true }; } },
  ownerResolver: { resolve: (principal) => { resolved.push(principal); return { ownerId: 'owner_opaque' }; } }
});
assert.deepEqual(await boundary.execute({ operation: 'profile.get' }), { ok: true });
assert.deepEqual(resolved, [undefined, { ownerId: 'owner_opaque', operation: 'profile.get', params: undefined }]);

console.log('boundary input tests passed');
