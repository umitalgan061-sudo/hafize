// Güvenlik sınırlarının `null`/bozuk girdi karşısındaki davranışını kilitler.
//
// `function f({ a } = {})` imzası yalnızca `undefined` için varsayılan uygular.
// `null` geldiğinde ham `TypeError` sızardı; bu da sınırın kendi sözleşme
// hatası yerine iç uygulama detayı taşıyan bir istisna üretmesi demekti.
// Buradaki testler her sınırın kendi tipli hatasını verdiğini veya
// fail-closed reddettiğini doğrular.

import assert from 'node:assert/strict';
import { isPlainInput, optionsOf } from '../lib/boundary-input.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';
import { createBearerPrincipalAuthenticator } from '../lib/server-auth.mjs';
import { normalizeMemoryRetrieval } from '../lib/memory-retrieval-boundary.mjs';
import { normalizeGitHubWriteRequest } from '../lib/github-write-contract.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const BAD_INPUTS = [null, undefined, 0, '', 'x', false, [], () => {}];

assert.equal(isPlainInput({ a: 1 }), true);
assert.equal(isPlainInput([]), false);
assert.equal(isPlainInput(null), false);
assert.deepEqual(optionsOf(null), {});
assert.deepEqual(optionsOf([1, 2]), {});
assert.equal(optionsOf(undefined).anything, undefined);
const passthrough = { principal: 'p' };
assert.equal(optionsOf(passthrough), passthrough);
assert.throws(() => { optionsOf(null).injected = true; }, TypeError);

// --- Konnektör okuma istemcileri --------------------------------------------
const tokenStore = { async load() { return null; } };
const fetchImpl = async () => ({ ok: true, async json() { return {}; } });
const gmailClient = createGmailReadClient({ tokenStore, fetchImpl, now: () => Date.now() });
const canvaClient = createCanvaReadClient({ tokenStore, fetchImpl, now: () => Date.now() });

for (const input of BAD_INPUTS) {
  await assert.rejects(() => gmailClient.read(input), /INVALID_GMAIL_READ/, `gmail read ${String(input)}`);
  await assert.rejects(() => canvaClient.read(input), /INVALID_CANVA_READ/, `canva read ${String(input)}`);
}

// Bilinmeyen üst düzey alanlar da sözleşme hatası üretir, sessizce yutulmaz.
await assert.rejects(
  () => gmailClient.read({ ownerId: 'owner', operation: 'profile.get', url: 'https://evil.example' }),
  /INVALID_GMAIL_READ:request\.url/
);
await assert.rejects(
  () => canvaClient.read({ ownerId: 'owner', operation: 'user.get', url: 'https://evil.example' }),
  /INVALID_CANVA_READ:request\.url/
);

// --- Araç sınırları ----------------------------------------------------------
const ownerResolver = { resolve: (principal) => (principal ? { ownerId: 'owner_opaque' } : null) };
const readCalls = [];
const readClient = { async read(request) { readCalls.push(request); return { ok: true }; } };
const gmailRead = createGmailReadToolBoundary({ readClient, ownerResolver });
const canvaRead = createCanvaReadToolBoundary({ readClient, ownerResolver });

for (const context of [null, undefined, 'principal', []]) {
  await assert.rejects(
    () => gmailRead.execute({ operation: 'profile.get' }, context),
    /INVALID_GMAIL_READ_TOOL:owner/
  );
  await assert.rejects(
    () => canvaRead.execute({ operation: 'user.get' }, context),
    /INVALID_CANVA_READ_TOOL:owner/
  );
}
assert.equal(readCalls.length, 0);

await gmailRead.execute({ operation: 'profile.get' }, { principal: { subject: 's' } });
assert.deepEqual(readCalls[0], { ownerId: 'owner_opaque', operation: 'profile.get', params: undefined });

for (const options of BAD_INPUTS) {
  assert.throws(() => createGmailReadToolBoundary(options), /INVALID_GMAIL_READ_TOOL:readClient/);
  assert.throws(() => createCanvaReadToolBoundary(options), /INVALID_CANVA_READ_TOOL:readClient/);
}

// --- Gmail gönderimi fail-closed kalır ---------------------------------------
const sent = [];
const gmailSend = createGmailSendToolBoundary({
  sendClient: { async send(command) { sent.push(command); return { messageId: 'm1' }; } },
  ownerResolver
});
const sendArgs = {
  to: ['someone@example.com'],
  subject: 'konu',
  text: 'gövde',
  explicitUserIntent: true
};
for (const context of [null, undefined, 'yes', [], {}, { principal: { subject: 's' } }]) {
  await assert.rejects(
    () => gmailSend.execute(sendArgs, context),
    /GMAIL_SEND_APPROVAL_REQUIRED/,
    `gmail send context ${String(context)}`
  );
}
assert.equal(sent.length, 0, 'onaysız bağlam hiçbir koşulda gönderim tetiklemez');

const receipt = await gmailSend.execute(sendArgs, { principal: { subject: 's' }, approvalGranted: true });
assert.deepEqual(receipt, { sent: true, messageId: 'm1' });
assert.equal(sent.length, 1);
assert.equal(sent[0].ownerId, 'owner_opaque');

// --- Sunucu kimlik doğrulaması -----------------------------------------------
const token = 't'.repeat(48);
const authenticator = createBearerPrincipalAuthenticator({ token, subject: 'owner' });
for (const request of [null, undefined, 'Bearer ' + token, [], {}, { headers: null }, { headers: 'x' }]) {
  assert.deepEqual(
    authenticator.authenticate(request),
    { ok: false, error: 'AUTH_REQUIRED' },
    `authenticate ${String(request)}`
  );
}
assert.equal(authenticator.authenticate({ headers: { authorization: `Bearer ${token}` } }).ok, true);
for (const options of BAD_INPUTS) {
  assert.throws(() => createBearerPrincipalAuthenticator(options), /INVALID_SERVER_AUTH:token/);
}

// --- Sözleşme normalleştiricileri --------------------------------------------
for (const input of BAD_INPUTS) {
  assert.deepEqual(normalizeMemoryRetrieval(input), {
    ok: false,
    error: 'INVALID_MEMORY_RETRIEVAL:ownerId'
  });
  assert.throws(
    () => normalizeGitHubWriteRequest({ operation: 'branch.create', repository: 'a/b', approvalGranted: true }, input),
    /GITHUB_WRITE_REPOSITORY_NOT_ALLOWED/,
    `github write options ${String(input)}`
  );
}
assert.deepEqual(
  normalizeGitHubWriteRequest(
    { operation: 'branch.create', repository: 'a/b', branch: 'feature', baseRef: 'main', approvalGranted: true },
    { allowedRepositories: new Set(['a/b']) }
  ),
  { operation: 'branch.create', repository: 'a/b', branch: 'feature', baseRef: 'main' }
);

// --- Zamanlama komut sınırı ve HTTP yüzeyi -----------------------------------
const storeCalls = [];
const scheduleStore = {
  async add(entry) { storeCalls.push(['add', entry]); return entry; },
  async read(id) { storeCalls.push(['read', id]); return null; },
  async snapshot() { storeCalls.push(['snapshot']); return { entries: [] }; },
  async cancel(id) { storeCalls.push(['cancel', id]); return null; }
};
const commands = createScheduleCommandBoundary({
  store: scheduleStore,
  registry: { agents: [{ id: 'hafize-general' }] },
  createTraceId: () => '00000000-0000-4000-8000-000000000001'
});

for (const command of BAD_INPUTS) {
  assert.deepEqual(await commands.create(command), { ok: false, error: 'AUTH_REQUIRED' });
  assert.deepEqual(await commands.list(command), { ok: false, error: 'AUTH_REQUIRED' });
  assert.deepEqual(await commands.cancel(command), { ok: false, error: 'AUTH_REQUIRED' });
}
assert.equal(storeCalls.length, 0, 'kimliksiz komut store\'a hiç ulaşmaz');

for (const options of BAD_INPUTS) {
  assert.throws(() => createScheduleCommandBoundary(options), /INVALID_SCHEDULE_COMMAND_BOUNDARY:store/);
  assert.throws(() => createScheduleHttpApi(options), /INVALID_SCHEDULE_HTTP_API:authenticator/);
}

let authenticateCalls = 0;
const api = createScheduleHttpApi({
  authenticator: { authenticate() { authenticateCalls += 1; return { ok: false, error: 'AUTH_REQUIRED' }; } },
  commands,
  readJson: async () => ({})
});
for (const incoming of BAD_INPUTS) {
  assert.deepEqual(await api.handle(incoming), { matched: false }, `handle ${String(incoming)}`);
}
assert.equal(authenticateCalls, 0, 'yol eşleşmeden kimlik doğrulama çalıştırılmaz');
const unauthorized = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: null });
assert.equal(unauthorized.status, 401);
assert.equal(unauthorized.body.error, 'AUTH_REQUIRED');
assert.equal(storeCalls.length, 0);

console.log('Boundary null-input tests passed: sınırlar ham TypeError yerine tipli sözleşme hatası üretiyor');
