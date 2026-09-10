import assert from 'node:assert/strict';
import { rankMemoryRecords, measureRetrievalQuality, scoreMemoryRecord } from '../lib/memory-quality.mjs';
import { createPersonalMemoryStore } from '../lib/personal-memory-store.mjs';

const now = Date.parse('2026-09-07T12:00:00.000Z');
const records = [
  { memoryId: 'memory_alpha12345', ownerId: 'u1', kind: 'preference', content: 'Kahvemi sütlü ve şekersiz içiyorum.', sourceType: 'conversation', sourceRef: null, createdAt: '2026-09-06T12:00:00.000Z', updatedAt: null },
  { memoryId: 'memory_beta12345', ownerId: 'u1', kind: 'decision', content: 'Projede küçük ve geri alınabilir PR tercih ediliyor.', sourceType: 'conversation', sourceRef: null, createdAt: '2026-08-01T12:00:00.000Z', updatedAt: null },
  { memoryId: 'memory_gamma12345', ownerId: 'u2', kind: 'preference', content: 'Gizli kayıt.', sourceType: 'conversation', sourceRef: null, createdAt: '2026-09-06T12:00:00.000Z', updatedAt: null }
];
const exact = scoreMemoryRecord(records[0], 'sütlü kahve', { now });
assert.equal(exact.lexical > 0, true); assert.equal(exact.score > 0, true);
const ranked = rankMemoryRecords(records.slice(0, 2), 'kahve sütlü', { now, limit: 2 });
assert.equal(ranked[0].memoryId, 'memory_alpha12345'); assert.equal(ranked.length, 2); assert.ok(ranked[0].metrics.score >= ranked[1].metrics.score);
const quality = measureRetrievalQuality({ expectedIds: ['memory_alpha12345'], ranked, minScore: 0.2 });
assert.equal(quality.topHit, 1); assert.equal(quality.precisionAtK, 0.5); assert.equal(quality.recallAtK, 1); assert.equal(quality.thresholdPass, true);
const store = createPersonalMemoryStore({ now: () => new Date(now), createId: (() => { let index = 0; return () => `stable${String(++index).padStart(8, '0')}`; })() });
// Yazma sözleşmesi açık kullanıcı niyeti, `personal` hassasiyeti ve kullanıcı
// kaynaklı sourceType değeri ister (docs/PERSONAL_MEMORY_CONTRACT.md).
const write = (input) => store.write({ sensitivity: 'personal', explicitUserIntent: true, sourceType: 'user_statement', ...input });
assert.equal(write({ ownerId: 'u1', kind: 'preference', content: 'Kahve sütlü ve şekersiz.' }).ok, true);
assert.equal(write({ ownerId: 'u1', kind: 'note', content: 'PR küçük tutulacak.' }).ok, true);
assert.equal(write({ ownerId: 'u2', kind: 'preference', content: 'Kahve başka kullanıcıya ait.' }).ok, true);
const read = store.read({ ownerId: 'u1', query: 'kahve', limit: 5 });
// Owner kapsamı ranking'den önce uygulanır; u2 kaydı hiçbir zaman dönmez.
assert.equal(read.ok, true); assert.equal(read.records.length, 2); assert.equal(read.records[0].ownerId, 'u1'); assert.match(read.records[0].content, /Kahve/);
assert.equal(read.records.some((record) => record.ownerId === 'u2'), false);
assert.throws(() => scoreMemoryRecord(null, 'x'), /INVALID_MEMORY_QUALITY_RECORD/);
assert.throws(() => scoreMemoryRecord(records[0], 'x'.repeat(501)), /INVALID_MEMORY_QUALITY_QUERY/);
assert.throws(() => rankMemoryRecords(Array.from({ length: 2049 }, () => records[0]), 'x'), /INVALID_MEMORY_QUALITY_RECORDS/);
console.log('memory quality tests passed');
