import { describe, expect, it } from 'vitest';
import { formatTaskHandoff, normalizeTaskHandoff } from './task-handoff.ts';

describe('typed task handoff', () => {
  it('normalizes bounded handoffs', () => {
    const result = normalizeTaskHandoff({
      agentId: 'researcher',
      task: 'Kaynağı incele',
      successCriteria: ['Kaynakları sırala'],
      constraints: ['Secret kullanma'],
      evidenceRequired: ['Dosya adlarını bildir']
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handoff.agentId).toBe('researcher');
      expect(Object.isFrozen(result.handoff)).toBe(true);
    }
  });

  it('rejects unknown and duplicate fields', () => {
    expect(normalizeTaskHandoff({ agentId: 'a', task: 'x', extra: true })).toEqual({
      ok: false, error: 'INVALID_TASK_HANDOFF:field'
    });
    expect(normalizeTaskHandoff({
      agentId: 'a', task: 'x', successCriteria: ['aynı', 'aynı']
    })).toMatchObject({ ok: false });
  });

  it('formats evidence and constraints without altering task semantics', () => {
    const result = formatTaskHandoff({
      agentId: 'researcher',
      task: 'Analiz et',
      successCriteria: ['Çıktıyı özetle'],
      constraints: ['Salt okunur'],
      evidenceRequired: ['Test sonucu']
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.task).toContain('Görev: Analiz et');
      expect(result.task).toContain('Başarı ölçütleri:');
      expect(result.task).toContain('Kısıtlar:');
      expect(result.task).toContain('Beklenen kanıt:');
    }
  });

  it('fails closed on oversized input', () => {
    const result = normalizeTaskHandoff({
      agentId: 'a',
      task: 'x'.repeat(20_001)
    });
    expect(result.ok).toBe(false);
  });
});
