import assert from 'node:assert/strict';
import { rankMemoryRecords, measureRetrievalQuality, scoreMemoryRecord } from '../lib/memory-quality.mjs';
import { createPersonalMemoryStore } from '../lib/personal-memory-store.mjs';

const now = Date.parse('2026-09-07T12:00:00.000Z');
const records = [
  { memoryId: 'memory_alpha12345', ownerId: 'u1', kind: 'preference', content: 'Kahvemi sütlü ve şekersiz içiyorum.', sourceType: 'user_statement', sourceRef: null, createdAt: '2026-09-06T12:00:00.000Z', updatedAt: null },
  { memoryId: 'memory_beta12345', ownerId: 'u1', kind: 'project', content: 'Projede küçük ve geri alınabilir PR tercih ediliyor.', sourceType: 'user_statement', sourceRef: null, createdAt: '2026-08-01T12:00:00.000Z', updatedAt: null },
  { memoryId: 'memory_gamma12345', ownerId: 'u2', kind: 'preference', content: 'Gizli kayıt.', sourceType: 'user_statement', sourceRef: null, createdAt: '2026-09-06T12:00:00.000Z', updatedAt: null }
];
const exact = scoreMemoryRecord(records[0], 'sütlü kahve', { now });
assert.equal(exact.lexical > 0, true); assert.equal(exact.score > 0, true);
const ranked = rankMemoryRecords(records.slice(0, 2), 'kahve sütlü', { now, limit: 2 });
assert.equal(ranked[0].memoryId, 'memory_alpha12345'); assert.equal(ranked.length, 2); assert.ok(ranked[0].metrics.score >= ranked[1].metrics.score);
const quality = measureRetrievalQuality({ expectedIds: ['memory_alpha12345'], ranked, minScore: 0.2 });
assert.equal(quality.topHit, 1); assert.equal(quality.precisionAtK, 0.5); assert.equal(quality.recallAtK, 1); assert.equal(quality.thresholdPass, true);
const store = createPersonalMemoryStore({ now: () => new Date(now), createId: (() => { let index = 0; return () => `stable${String(++index).padStart(8, '0')}`; })() });
assert.equal(store.write({ ownerId: 'u1', kind: 'preference', content: 'Kahve sütlü ve şekersiz.', sourceType: 'user_statement', sensitivity: 'personal', explicitUserIntent: true }).ok, true);
assert.equal(store.write({ ownerId: 'u1', kind: 'project', content: 'PR küçük tutulacak.', sourceType: 'user_statement', sensitivity: 'personal', explicitUserIntent: true }).ok, true);
assert.equal(store.write({ ownerId: 'u2', kind: 'preference', content: 'Kahve başka kullanıcıya ait.', sourceType: 'user_statement', sensitivity: 'personal', explicitUserIntent: true }).ok, true);
const read = store.read({ ownerId: 'u1', query: 'kahve', limit: 5 });
// read() ranks the owner's records rather than filtering them, so the match leads and
// another owner's record never appears at all.
assert.equal(read.ok, true); assert.equal(read.records.length, 2);
assert.equal(read.records.every((record) => record.ownerId === 'u1'), true);
assert.match(read.records[0].content, /Kahve/);
assert.throws(() => scoreMemoryRecord(null, 'x'), /INVALID_MEMORY_QUALITY_RECORD/);
assert.throws(() => scoreMemoryRecord(records[0], 'x'.repeat(501)), /INVALID_MEMORY_QUALITY_QUERY/);
assert.throws(() => rankMemoryRecords(Array.from({ length: 2049 }, () => records[0]), 'x'), /INVALID_MEMORY_QUALITY_RECORDS/);
console.log('memory quality tests passed');
