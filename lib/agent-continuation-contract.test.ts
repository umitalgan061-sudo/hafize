import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

describe('agent completion server wiring', () => {
  it('uses a bounded configurable multi-tool budget instead of four hardcoded rounds', () => {
    expect(source).toMatch(/MAX_AGENT_TOOL_ROUNDS = boundedEnvInteger\(process\.env\.HAFIZE_AGENT_TOOL_ROUNDS, 200, 4, 200\)/);
    expect(source).not.toContain('const MAX_AGENT_TOOL_ROUNDS = 4;');
  });

  it('reminds the agent to use authorized development tools before spending the whole budget reading', () => {
    expect(source).toContain('round % 4 === 0');
    expect(source).toContain('workingMessages[budgetReminderIndex] = reminder');
    expect(source).toContain('10_800_000, 60_000, 10_800_000');
    expect(source).toContain('MAX_AGENT_TOOL_ROUNDS - round');
    expect(source).toContain('github_develop');
    expect(source).toContain('Kullanıcı izni ve araç güvenlik sınırları değişmez');
  });

  it('offers a second model repair and deterministic honest fallback', () => {
    expect(source).toContain('buildFinalToolInstruction(toolSummary)');
    expect(source).toContain('isEmptyOrProgressOnlyAnswer(finalText)');
    expect(source).toContain('incompleteAgentRunAnswer(toolSummary, incompleteReason)');
    expect(source).not.toContain('Soruyu biraz farklı ifade ederek tekrar sorabilir misin?');
  });

  it('marks unresolved tasks as failed rather than success', () => {
    expect(source).toContain('incomplete_agent_answer');
    expect(source).toContain('ok: !anyToolFailed && !unresolved');
  });
});
