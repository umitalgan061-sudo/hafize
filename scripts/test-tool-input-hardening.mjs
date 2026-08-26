// Model tarafından üretilen argümanlarla ulaşılabilen her tool giriş noktasının
// düşmanca girdiyi doğrulanmış hata koduyla reddettiğini kilitler.
//
// Bu tur `read(null)` çağrısının doğrulanmış `INVALID_*_READ` yerine ham
// `TypeError` fırlattığı iki gerçek hata düzeltildi. Ham TypeError, hata
// yüzeyini sızdırdığı ve çağıranın hata koduna göre dallanmasını bozduğu için
// güvenlik açısından önemlidir. Bu test aynı hata sınıfının geri gelmesini
// engeller.

import assert from 'node:assert/strict';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';
import { executeNvidiaToolCall } from '../lib/tool-runtime.mjs';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';

// Hiçbir doğrulama çağrısı ağa veya token store'a ulaşmamalıdır.
const forbiddenFetch = () => {
  throw new Error('NETWORK_CALL_LEAKED');
};
const forbiddenTokenStore = {
  load: async () => {
    throw new Error('TOKEN_STORE_ACCESS_LEAKED');
  }
};
const ownerResolver = { resolve: () => ({ ownerId: 'owner_opaque' }) };
const unreachableRead = {
  read: async () => {
    throw new Error('READ_CLIENT_REACHED');
  }
};
const unreachableSend = {
  send: async () => {
    throw new Error('SEND_CLIENT_REACHED');
  }
};

// Bir tool giriş noktasına ulaşabilen düşmanca argüman biçimleri.
const HOSTILE_ARGUMENTS = [
  null,
  undefined,
  0,
  '',
  'profile.get',
  true,
  [],
  [{ operation: 'profile.get' }],
  // Model argümanları JSON.parse'tan gelir: `__proto__` prototip bağı değil,
  // bilinmeyen bir own-property olur ve allowlist tarafından reddedilmelidir.
  JSON.parse('{"__proto__":{"operation":"profile.get"}}'),
  { operation: 'profile.get', extra: 'x' }
];

async function assertRejectsCode(fn, pattern, label) {
  await assert.rejects(fn, (error) => {
    assert.ok(error instanceof Error, `${label}: Error bekleniyordu`);
    assert.equal(
      error instanceof TypeError,
      false,
      `${label}: ham TypeError sızdı — ${error.message}`
    );
    assert.match(error.message, pattern, label);
    return true;
  }, label);
}

const gmailReadClient = createGmailReadClient({
  tokenStore: forbiddenTokenStore,
  fetchImpl: forbiddenFetch,
  now: () => Date.now()
});
const canvaReadClient = createCanvaReadClient({
  tokenStore: forbiddenTokenStore,
  fetchImpl: forbiddenFetch,
  now: () => Date.now()
});

for (const input of HOSTILE_ARGUMENTS) {
  const label = `read(${JSON.stringify(input) ?? String(input)})`;
  await assertRejectsCode(() => gmailReadClient.read(input), /INVALID_GMAIL_READ/, `gmail ${label}`);
  await assertRejectsCode(() => canvaReadClient.read(input), /INVALID_CANVA_READ/, `canva ${label}`);
}

// Geçerli operasyon ama bilinmeyen üst alan da reddedilir (strict object).
await assertRejectsCode(
  () => gmailReadClient.read({ ownerId: 'owner_opaque', operation: 'profile.get', tokenStore: {} }),
  /INVALID_GMAIL_READ:request\.tokenStore/,
  'gmail unknown top-level field'
);
await assertRejectsCode(
  () => canvaReadClient.read({ ownerId: 'owner_opaque', operation: 'user.get', fetchImpl: {} }),
  /INVALID_CANVA_READ:request\.fetchImpl/,
  'canva unknown top-level field'
);

const gmailReadTool = createGmailReadToolBoundary({ readClient: unreachableRead, ownerResolver });
const canvaReadTool = createCanvaReadToolBoundary({ readClient: unreachableRead, ownerResolver });
const gmailSendTool = createGmailSendToolBoundary({ sendClient: unreachableSend, ownerResolver });

for (const input of HOSTILE_ARGUMENTS) {
  const label = `execute(${JSON.stringify(input) ?? String(input)})`;
  await assertRejectsCode(
    () => gmailReadTool.execute(input, { principal: {} }),
    /INVALID_GMAIL_READ_TOOL/,
    `gmail read tool ${label}`
  );
  await assertRejectsCode(
    () => canvaReadTool.execute(input, { principal: {} }),
    /INVALID_CANVA_READ_TOOL/,
    `canva read tool ${label}`
  );
  // Gönderme aracı ayrıca açık onay olmadan hiçbir girdiyi kabul etmez.
  await assert.rejects(
    () => gmailSendTool.execute(input, { principal: {}, approvalGranted: true }),
    (error) => error instanceof Error && !(error instanceof TypeError),
    `gmail send tool ${label}`
  );
}

// Onay verilmemiş gönderme, argüman geçerli olsa bile reddedilir.
await assert.rejects(
  () => gmailSendTool.execute(
    { to: ['kisi@example.com'], subject: 'test', bodyText: 'merhaba' },
    { principal: {}, approvalGranted: false }
  ),
  (error) => error instanceof Error && !(error instanceof TypeError)
);

// NVIDIA tool dispatch katmanı bozuk tool call'da istisna değil hata nesnesi döndürür.
const registry = await loadAgentRegistry();
const agent = resolveAgent(registry, 'hafize-general');
for (const toolCall of [null, undefined, {}, { function: null }, { function: { name: 42 } }, { function: { name: 'repo_delete' } }]) {
  const result = await executeNvidiaToolCall(agent, toolCall, {});
  assert.equal(result.ok, false);
  assert.equal(result.error, 'UNKNOWN_TOOL');
}
const badArguments = await executeNvidiaToolCall(
  agent,
  { function: { name: 'runtime_status', arguments: '{not json' } },
  { registry, agent, traceId: 't1' }
);
assert.equal(badArguments.ok, false);
assert.equal(badArguments.error, 'INVALID_TOOL_ARGUMENTS');

console.log('tool input hardening OK: connector ve dispatch giriş noktaları düşmanca girdiyi doğrulanmış hatayla reddediyor');
