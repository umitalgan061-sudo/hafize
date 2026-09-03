import assert from 'node:assert/strict';
import {
  MEMORY_CONSOLIDATION_CONTRACT,
  normalizeConsolidationApproval,
  planMemoryConsolidation
} from '../lib/memory-consolidation.mjs';
import { createPersonalMemoryStore } from '../lib/personal-memory-store.mjs';

function record(memoryId, content, extra = {}) {
  return {
    memoryId,
    ownerId: 'owner_1',
    kind: 'preference',
    content,
    sourceType: 'user_statement',
    sourceRef: null,
    sensitivity: 'personal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
    ...extra
  };
}

for (const input of [
  undefined, null, {}, { ownerId: 'owner_1' }, { ownerId: '', records: [] },
  { ownerId: 'owner_1', records: [], extra: 1 },
  { ownerId: 'owner_1', records: {} },
  { ownerId: 'owner_1', records: [], similarityThreshold: 0.1 },
  { ownerId: 'owner_1', records: [], similarityThreshold: '0.9' },
  { ownerId: 'owner_1', records: [], maxGroups: 0 },
  { ownerId: 'owner_1', records: [record('memory_aaaaaaaa', 'x'), record('memory_aaaaaaaa', 'x')] },
  { ownerId: 'owner_1', records: [record('memory_aaaaaaaa', 'x', { sensitivity: 'public' })] },
  { ownerId: 'owner_1', records: [record('memory_aaaaaaaa', 'x', { kind: 'secret' })] },
  { ownerId: 'owner_1', records: [record('memory_aaaaaaaa', 'x', { createdAt: 'dün' })] },
  { ownerId: 'owner_1', records: [record('bad_id_value', 'x')] }
]) {
  assert.equal(planMemoryConsolidation(input).ok, false);
}

// Başka bir sahibin kaydı asla plana giremez.
const crossOwner = planMemoryConsolidation({
  ownerId: 'owner_1',
  records: [record('memory_aaaaaaaa', 'x', { ownerId: 'owner_2' })]
});
assert.deepEqual(crossOwner, { ok: false, error: 'MEMORY_CONSOLIDATION_OWNER_MISMATCH' });

// Aynı içerik tekrarında en yeni kayıt korunur, eskiler aday olur.
const exact = planMemoryConsolidation({
  ownerId: 'owner_1',
  records: [
    record('memory_old00001', 'Sabah kahvemi sade içerim'),
    record('memory_new00001', 'Sabah kahvemi sade içerim', { createdAt: '2026-02-01T00:00:00.000Z' }),
    record('memory_uniq0001', 'Toplantıları öğleden sonra planla')
  ]
});
assert.equal(exact.ok, true);
assert.equal(exact.plan.groups.length, 1);
assert.equal(exact.plan.groups[0].keepMemoryId, 'memory_new00001');
assert.deepEqual(exact.plan.groups[0].duplicates.map((item) => item.memoryId), ['memory_old00001']);
assert.equal(exact.plan.groups[0].duplicates[0].similarity, 1);
assert.deepEqual(exact.plan.stats, {
  records: 3,
  groups: 1,
  duplicateCandidates: 1,
  recordsAfterApproval: 2
});

// Yakın ama aynı olmayan kayıtlar eşiğe göre gruplanır.
const near = {
  ownerId: 'owner_1',
  records: [
    record('memory_near0001', 'Bildirimleri akşam 22 den sonra kapat', { createdAt: '2026-03-01T00:00:00.000Z' }),
    record('memory_near0002', 'Bildirimleri akşam 22 den sonra kapatalım', { createdAt: '2026-02-01T00:00:00.000Z' })
  ]
};
assert.equal(planMemoryConsolidation({ ...near, similarityThreshold: 0.99 }).plan.groups.length, 0);
const loose = planMemoryConsolidation({ ...near, similarityThreshold: 0.7 });
assert.equal(loose.plan.groups.length, 1);
assert.equal(loose.plan.groups[0].duplicates[0].similarity < 1, true);

// Farklı kind'ler birleştirilmez.
const mixedKinds = planMemoryConsolidation({
  ownerId: 'owner_1',
  records: [
    record('memory_kind0001', 'İsmim Ümit', { kind: 'identity' }),
    record('memory_kind0002', 'İsmim Ümit', { kind: 'note' })
  ]
});
assert.equal(mixedKinds.plan.groups.length, 0);

// Onay sözleşmesi: açık kullanıcı niyeti olmadan komut üretilmez.
const { plan } = exact;
const groupId = plan.groups[0].groupId;
for (const input of [
  undefined,
  { ownerId: 'owner_1', plan, approvedGroupIds: [groupId] },
  { ownerId: 'owner_1', plan, approvedGroupIds: [groupId], explicitUserIntent: 'evet' },
  { ownerId: 'owner_1', plan, approvedGroupIds: [], explicitUserIntent: true },
  { ownerId: 'owner_1', plan, approvedGroupIds: [groupId, groupId], explicitUserIntent: true },
  { ownerId: 'owner_1', plan, approvedGroupIds: ['group_memory_yok0001'], explicitUserIntent: true },
  { ownerId: 'owner_2', plan, approvedGroupIds: [groupId], explicitUserIntent: true },
  { ownerId: 'owner_1', plan: { ownerId: 'owner_1' }, approvedGroupIds: [groupId], explicitUserIntent: true },
  { ownerId: 'owner_1', plan, approvedGroupIds: [groupId], explicitUserIntent: true, extra: 1 }
]) {
  assert.equal(normalizeConsolidationApproval(input).ok, false);
}

// Korunan kayıt silme komutuna dönüştürülemez.
const tampered = {
  ownerId: 'owner_1',
  groups: [{ groupId: 'g1', keepMemoryId: 'memory_new00001', duplicates: [{ memoryId: 'memory_new00001' }] }]
};
assert.deepEqual(
  normalizeConsolidationApproval({
    ownerId: 'owner_1', plan: tampered, approvedGroupIds: ['g1'], explicitUserIntent: true
  }),
  { ok: false, error: 'MEMORY_CONSOLIDATION_KEEP_RECORD_PROTECTED' }
);

const approval = normalizeConsolidationApproval({
  ownerId: 'owner_1', plan, approvedGroupIds: [groupId], explicitUserIntent: true
});
assert.deepEqual(approval, {
  ok: true,
  commands: [{ ownerId: 'owner_1', memoryId: 'memory_old00001', exactMatch: true }]
});

// Store ile uçtan uca: yalnız onaylanan kopyalar silinir, korunan kayıt kalır.
let clock = Date.parse('2026-04-01T00:00:00.000Z');
let counter = 0;
const store = createPersonalMemoryStore({
  now: () => new Date((clock += 60_000)),
  createId: () => `consolidation${String(counter += 1).padStart(2, '0')}`
});
for (const content of ['Kahveyi sade içerim', 'Kahveyi sade içerim', 'Haftalık özet cuma günü']) {
  assert.equal(store.write({
    ownerId: 'owner_1', kind: 'preference', content, sourceType: 'user_statement',
    sourceRef: null, sensitivity: 'personal', explicitUserIntent: true
  }).ok, true);
}
const live = planMemoryConsolidation({ ownerId: 'owner_1', records: store.snapshot().entries });
assert.equal(live.plan.stats.duplicateCandidates, 1);
const liveApproval = normalizeConsolidationApproval({
  ownerId: 'owner_1',
  plan: live.plan,
  approvedGroupIds: live.plan.groups.map((group) => group.groupId),
  explicitUserIntent: true
});
for (const command of liveApproval.commands) {
  assert.equal(store.remove(command).ok, true);
}
const left = store.snapshot().entries;
assert.equal(left.length, 2);
assert.equal(left.some((entry) => entry.memoryId === live.plan.groups[0].keepMemoryId), true);

assert.equal(MEMORY_CONSOLIDATION_CONTRACT.requiresExplicitApproval, true);
assert.equal(Object.isFrozen(MEMORY_CONSOLIDATION_CONTRACT), true);

console.log('memory consolidation tests passed');
