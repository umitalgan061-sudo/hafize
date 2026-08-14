import assert from 'node:assert/strict';
import { formatTaskHandoff, normalizeTaskHandoff } from '../lib/task-handoff.mjs';

const basic = normalizeTaskHandoff({ agentId: 'specialist-a', task: 'Kontrol et.' });
assert.equal(basic.ok, true);
assert.deepEqual(basic.handoff.successCriteria, []);
assert.deepEqual(basic.handoff.constraints, []);
assert.deepEqual(basic.handoff.evidenceRequired, []);

const detailed = normalizeTaskHandoff({
  agentId: 'specialist-a',
  task: 'Planı kontrol et.',
  successCriteria: ['Sonuç gözlenebilir olsun', 'Eksikler açıkça belirtilecek'],
  constraints: ['Kapsam dışına çıkma'],
  evidenceRequired: ['İncelenen girdileri belirt']
});
assert.equal(detailed.ok, true);
assert.equal(detailed.handoff.successCriteria.length, 2);
assert.equal(detailed.handoff.constraints.length, 1);
assert.equal(detailed.handoff.evidenceRequired.length, 1);

const formatted = formatTaskHandoff(detailed.handoff);
assert.equal(formatted.ok, true);
assert.match(formatted.task, /^Görev: Planı kontrol et\./);
assert.match(formatted.task, /Başarı ölçütleri:/);
assert.match(formatted.task, /Kısıtlar:/);
assert.match(formatted.task, /Beklenen kanıt:/);

assert.deepEqual(normalizeTaskHandoff(null), { ok: false, error: 'INVALID_TASK_HANDOFF:input' });
assert.deepEqual(
  normalizeTaskHandoff({ agentId: '', task: 'x' }),
  { ok: false, error: 'INVALID_TASK_HANDOFF:agentId' }
);
assert.deepEqual(
  normalizeTaskHandoff({ agentId: 'a', task: '' }),
  { ok: false, error: 'INVALID_TASK_HANDOFF:task' }
);
assert.deepEqual(
  normalizeTaskHandoff({ agentId: 'a', task: 'x', constraints: ['aynı', 'aynı'] }),
  { ok: false, error: 'INVALID_TASK_HANDOFF:constraints.duplicate' }
);
assert.deepEqual(
  normalizeTaskHandoff({
    agentId: 'a',
    task: 'x',
    evidenceRequired: Array.from({ length: 9 }, (_, index) => `item-${index}`)
  }),
  { ok: false, error: 'INVALID_TASK_HANDOFF:evidenceRequired' }
);

console.log('task handoff tests passed');
