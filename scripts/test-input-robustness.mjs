import assert from 'node:assert/strict';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createConnectorOwnerResolver } from '../lib/connector-owner-principal.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';
import { normalizeGmailSendRequest } from '../lib/gmail-send-contract.mjs';
import { normalizeGitHubWriteRequest } from '../lib/github-write-contract.mjs';

// Bozuk girdi/bağlam nesneleri (özellikle null) TypeError yerine kodlu ve
// fail-closed doğrulama hatası üretmelidir: TypeError araç katmanında
// anlamsız TOOL_EXECUTION_FAILED'a dönüşür ve çağıranın hata sözleşmesini bozar.
const MALFORMED = [null, [], 'x', 42, true];

function assertCodedError(error, pattern, label) {
  assert.equal(error instanceof TypeError, false, `${label} TypeError fırlattı: ${error?.message}`);
  assert.match(String(error?.message), pattern, label);
}

async function assertRejectsCoded(label, run, pattern) {
  await assert.rejects(run, (error) => {
    assertCodedError(error, pattern, label);
    return true;
  });
}

function assertThrowsCoded(label, run, pattern) {
  assert.throws(run, (error) => {
    assertCodedError(error, pattern, label);
    return true;
  });
}

const tokenStore = { load: async () => null };
const gmailClient = createGmailReadClient({ tokenStore, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
const canvaClient = createCanvaReadClient({ tokenStore, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });

for (const input of [...MALFORMED, undefined]) {
  const label = `read(${JSON.stringify(input) ?? 'undefined'})`;
  await assertRejectsCoded(`gmail ${label}`, () => gmailClient.read(input), /INVALID_GMAIL_READ/);
  await assertRejectsCoded(`canva ${label}`, () => canvaClient.read(input), /INVALID_CANVA_READ/);
}

const ownerResolver = createConnectorOwnerResolver({ key: Buffer.alloc(32, 7) });
const gmailRead = createGmailReadToolBoundary({ readClient: { read: async () => ({}) }, ownerResolver });
const canvaRead = createCanvaReadToolBoundary({ readClient: { read: async () => ({}) }, ownerResolver });
const gmailSend = createGmailSendToolBoundary({ sendClient: { send: async () => ({}) }, ownerResolver });

for (const context of [...MALFORMED, undefined]) {
  const label = `context=${JSON.stringify(context) ?? 'undefined'}`;
  // Bağlam kaybolduğunda principal çözümlenemez; okuma sahipsiz çalışmaz.
  await assertRejectsCoded(
    `gmail_read ${label}`,
    () => gmailRead.execute({ operation: 'message.get', params: { messageId: 'm1' } }, context),
    /INVALID_CONNECTOR_PRINCIPAL:principal/
  );
  await assertRejectsCoded(
    `canva_read ${label}`,
    () => canvaRead.execute({ operation: 'design.get', params: { designId: 'DAF1' } }, context),
    /INVALID_CONNECTOR_PRINCIPAL:principal/
  );
  // Onay bağlamı kaybolduğunda gönderim sessizce geçmez, onay hatası verir.
  await assertRejectsCoded(
    `gmail_send ${label}`,
    () => gmailSend.execute(
      { explicitUserIntent: true, to: ['kisi@example.com'], subject: 'Konu', text: 'Metin' },
      context
    ),
    /GMAIL_SEND_APPROVAL_REQUIRED/
  );
}

// Bozuk principal çözümlemesi sahibi olmayan bir çağrıyı geçirmemelidir.
const noOwner = createGmailReadToolBoundary({ readClient: { read: async () => ({}) }, ownerResolver: { resolve: () => null } });
await assertRejectsCoded(
  'gmail_read owner=null',
  () => noOwner.execute({ operation: 'profile.get' }, { principal: {} }),
  /INVALID_GMAIL_READ_TOOL:owner/
);

for (const options of MALFORMED) {
  const label = `options=${JSON.stringify(options)}`;
  assertThrowsCoded(
    `gmail send contract ${label}`,
    () => normalizeGmailSendRequest({ explicitUserIntent: true, to: ['kisi@example.com'], subject: 'Konu', text: 'Metin' }, options),
    /GMAIL_SEND_APPROVAL_REQUIRED/
  );
  assertThrowsCoded(
    `github write contract ${label}`,
    () => normalizeGitHubWriteRequest(
      { operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'x', baseRef: 'main', approvalGranted: true },
      options
    ),
    /GITHUB_WRITE_REPOSITORY_NOT_ALLOWED/
  );
}

// Geçerli seçenekler bozulmadan çalışmaya devam eder.
assert.equal(
  normalizeGmailSendRequest(
    { explicitUserIntent: true, to: ['kisi@example.com'], subject: 'Konu', text: 'Metin' },
    { approvalGranted: true }
  ).operation,
  'message.send'
);
assert.equal(
  normalizeGitHubWriteRequest(
    { operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'x', baseRef: 'main', approvalGranted: true },
    { allowedRepositories: new Set(['umitalgan061-sudo/hafize']) }
  ).repository,
  'umitalgan061-sudo/hafize'
);

console.log('input robustness OK: bozuk girdi ve bağlam nesneleri kodlu, fail-closed hatalar üretiyor');
