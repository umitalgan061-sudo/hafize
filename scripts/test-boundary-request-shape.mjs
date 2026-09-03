// İstek gövdesi sözleşmesi: modelden, HTTP callback'inden veya bir tool
// çağrısından gelen istek nesnesi hiçbir zaman ham TypeError üretmemelidir.
//
// `function f({ a, b } = {})` biçimi yalnız `undefined` için varsayılan uygular;
// `null` verildiğinde destructuring çöker ve sınır, sözleşme kodu yerine iç
// hata mesajı sızdıran bir TypeError fırlatır. Bu test tüm istek yüzeylerini
// null/dizi/metin/sayı ile yoklayarak bu sınıfın geri gelmesini engeller.
import assert from 'node:assert/strict';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createCanvaTokenExchange } from '../lib/canva-token-exchange.mjs';
import { createCanvaTokenRefresh } from '../lib/canva-token-refresh.mjs';
import { createCanvaTokenRevoke } from '../lib/canva-token-revoke.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';
import { createGoogleTokenExchange } from '../lib/google-token-exchange.mjs';
import { normalizeGitHubWriteRequest } from '../lib/github-write-contract.mjs';
import { normalizeGmailSendRequest } from '../lib/gmail-send-contract.mjs';

const MALFORMED_REQUESTS = [null, [], 'owner', 42, true];

const tokenStore = { load: async () => null, save: async () => {}, remove: async () => {} };
const fetchImpl = async () => ({ ok: true, async json() { return {}; } });
const now = () => Date.now();
const clientOptions = { clientId: 'client-id', clientSecret: 'client-secret', tokenStore, fetchImpl, now };
const readClient = { read: async () => ({}) };
const ownerResolver = { resolve: async () => 'owner_opaque' };

const surfaces = [
  ['canva.read', createCanvaReadClient({ tokenStore, fetchImpl, now }).read],
  ['gmail.read', createGmailReadClient({ tokenStore, fetchImpl, now }).read],
  ['canva.token.exchange', createCanvaTokenExchange(clientOptions).exchange],
  ['canva.token.refresh', createCanvaTokenRefresh(clientOptions).refresh],
  ['canva.token.revoke', createCanvaTokenRevoke(clientOptions).revoke],
  ['google.token.exchange', createGoogleTokenExchange(clientOptions).exchange],
  ['canva.tool.execute', createCanvaReadToolBoundary({ readClient, ownerResolver }).execute],
  ['gmail.tool.execute', createGmailReadToolBoundary({ readClient, ownerResolver }).execute],
  ['gmail.send.execute', createGmailSendToolBoundary({ sendClient: { send: async () => ({}) }, ownerResolver }).execute],
  ['github.write.normalize', (request) => normalizeGitHubWriteRequest(request, { allowedRepositories: ['owner/repo'] })],
  ['gmail.send.normalize', (request) => normalizeGmailSendRequest(request, { approvalGranted: true })]
];

for (const [name, call] of surfaces) {
  for (const request of MALFORMED_REQUESTS) {
    const label = `${name}(${JSON.stringify(request) ?? 'undefined'})`;
    let thrown = null;
    try {
      await call(request, { principal: { ownerId: 'owner_opaque' }, approvalGranted: false });
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown, `${label} bozuk isteği reddetmeli`);
    assert.equal(thrown instanceof TypeError, false, `${label} ham TypeError sızdırmamalı: ${thrown.message}`);
    assert.match(thrown.message, /^[A-Z][A-Z0-9_]*(:[A-Za-z0-9_.-]+)?$/, `${label} sözleşme kodu döndürmeli`);
    // Hata mesajı istemciye dönebildiği için iç ayrıntı taşımamalıdır.
    assert.equal(/Cannot |undefined|intermediate value/.test(thrown.message), false, label);
  }
}

console.log(`boundary request shape OK: ${surfaces.length} yüzey × ${MALFORMED_REQUESTS.length} bozuk istek`);
