import assert from 'node:assert/strict';
import { normalizeGitHubWriteRequest } from '../lib/github-write-contract.mjs';
import { normalizeGmailSendRequest } from '../lib/gmail-send-contract.mjs';
import { normalizeMemoryRetrieval } from '../lib/memory-retrieval-boundary.mjs';
import { normalizeTaskHandoff } from '../lib/task-handoff.mjs';
import {
  normalizeMemoryDelete,
  normalizeMemoryRead,
  normalizeMemoryWrite
} from '../lib/personal-memory-contract.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';

// Modelden veya HTTP gövdesinden gelen argüman her zaman güvenilmezdir. Bu paket,
// dış girdiyi karşılayan sınırların düşmanca çağrılarda kendi sözleşme hatalarını
// ürettiğini doğrular. Ham TypeError sızması hata sayılır: çağıran taraf onu
// beklemez, mesajı sözleşmenin parçası değildir ve iç yapıyı ele verebilir.
const HOSTILE_INPUTS = Object.freeze([null, [], 'metin', 42, true, () => {}]);

// 1) Sonuç nesnesi dönen aile: hiçbir girdide fırlatmamalı, `ok:false` dönmeli.
const RESULT_STYLE = Object.freeze([
  ['normalizeMemoryWrite', normalizeMemoryWrite],
  ['normalizeMemoryRead', normalizeMemoryRead],
  ['normalizeMemoryDelete', normalizeMemoryDelete],
  ['normalizeTaskHandoff', normalizeTaskHandoff],
  ['normalizeMemoryRetrieval', normalizeMemoryRetrieval]
]);

for (const [label, normalize] of RESULT_STYLE) {
  for (const input of HOSTILE_INPUTS) {
    let result;
    assert.doesNotThrow(() => { result = normalize(input); }, `${label} ham hata fırlattı`);
    assert.equal(typeof result, 'object', `${label} nesne dönmedi`);
    assert.equal(result?.ok, false, `${label} düşmanca girdiyi kabul etti`);
    assert.equal(typeof result.error, 'string', `${label} hata kodu döndürmedi`);
    assert.ok(result.error.startsWith('INVALID_'), `${label} beklenmeyen hata kodu: ${result.error}`);
  }
  assert.doesNotThrow(() => normalize(), `${label} argümansız çağrıda fırlattı`);
}

// 2) Fırlatan aile: hata `Error` olmalı, TypeError gibi programlama hatası olmamalı.
const THROW_STYLE = Object.freeze([
  ['normalizeGitHubWriteRequest', (input) => normalizeGitHubWriteRequest(input, { allowedRepositories: ['owner/repo'] })],
  ['normalizeGmailSendRequest', (input) => normalizeGmailSendRequest(input, { approvalGranted: true })]
]);

for (const [label, normalize] of THROW_STYLE) {
  for (const input of HOSTILE_INPUTS) {
    assert.throws(
      () => normalize(input),
      (error) => {
        assert.ok(error instanceof Error, `${label} Error dışında bir değer fırlattı`);
        assert.equal(error instanceof TypeError, false, `${label} ham TypeError sızdırdı: ${error.message}`);
        assert.ok(/^INVALID_/.test(error.message), `${label} beklenmeyen hata: ${error.message}`);
        return true;
      },
      `${label} düşmanca girdiyi reddetmedi`
    );
  }
}

// 3) Tool sınırları: model üretimi argümanlar bağlı servise hiç ulaşmamalı.
const stubs = { readClient: { read: async () => { throw new Error('UPSTREAM_SHOULD_NOT_BE_CALLED'); } } };
const ownerResolver = { resolve: () => ({ ownerId: 'owner_opaque' }) };
const toolBoundaries = Object.freeze([
  ['gmail_read', createGmailReadToolBoundary({ ...stubs, ownerResolver }), /INVALID_GMAIL_READ_TOOL/],
  ['canva_read', createCanvaReadToolBoundary({ ...stubs, ownerResolver }), /INVALID_CANVA_READ_TOOL/]
]);

for (const [label, boundary, pattern] of toolBoundaries) {
  for (const input of HOSTILE_INPUTS) {
    await assert.rejects(
      () => boundary.execute(input, { principal: { id: 'owner_opaque' } }),
      (error) => {
        assert.equal(error instanceof TypeError, false, `${label} ham TypeError sızdırdı: ${error.message}`);
        assert.match(error.message, pattern);
        return true;
      },
      `${label} düşmanca argümanı reddetmedi`
    );
  }
}

console.log('input boundary contract tests passed');
