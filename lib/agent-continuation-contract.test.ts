import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

describe('agent completion server wiring', () => {
  it('uses a bounded configurable multi-tool budget instead of four hardcoded rounds', () => {
    expect(source).toMatch(/MAX_AGENT_TOOL_ROUNDS = boundedEnvInteger\(process\.env\.HAFIZE_AGENT_TOOL_ROUNDS, 8, 4, 12\)/);
    expect(source).not.toContain('const MAX_AGENT_TOOL_ROUNDS = 4;');
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
