import assert from 'node:assert/strict';
import { normalizeTaskHandoff } from '../lib/task-handoff.mjs';

assert.deepEqual(
  normalizeTaskHandoff({ agentId: 'specialist-a', task: 'Kontrol et.', extraField: 'x' }),
  { ok: false, error: 'INVALID_TASK_HANDOFF:field' }
);

const normalized = normalizeTaskHandoff({
  agentId: 'specialist-a',
  task: 'Kontrol et.',
  successCriteria: ['İlk satır\nİkinci satır'],
  constraints: ['  Tek   satır\t kal  ']
});
assert.equal(normalized.ok, true);
assert.deepEqual(normalized.handoff.successCriteria, ['İlk satır İkinci satır']);
assert.deepEqual(normalized.handoff.constraints, ['Tek satır kal']);

assert.deepEqual(
  normalizeTaskHandoff({
    agentId: 'specialist-a',
    task: 'Kontrol et.',
    constraints: ['aynı\nmadde', 'aynı madde']
  }),
  { ok: false, error: 'INVALID_TASK_HANDOFF:constraints.duplicate' }
);

console.log('strict task handoff tests passed');
