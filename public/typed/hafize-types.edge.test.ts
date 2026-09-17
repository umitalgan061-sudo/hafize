import { describe, expect, it } from 'vitest';
import { parseAgents, parseHealth, parseModels } from './hafize-types.ts';

describe('typed contract hostile payloads', () => {
  it('bounds oversized agent fields', () => {
    const payload = {
      defaultAgent: 'd'.repeat(500),
      agents: [{ id: 'a'.repeat(500), name: 'b'.repeat(500), description: 'c'.repeat(500), tools: Array(200).fill('tool') }]
    };
    const parsed = parseAgents(payload);
    expect(parsed.defaultAgent).toHaveLength(160);
    expect(parsed.agents[0]?.id).toHaveLength(160);
    expect(parsed.agents[0]?.name).toHaveLength(160);
    expect(parsed.agents[0]?.description).toHaveLength(320);
    expect(parsed.agents[0]?.tools).toHaveLength(64);
  });

  it('ignores prototype-like keys instead of carrying them into the result', () => {
    // `JSON.parse` is the only way to build a payload with a literal
    // `__proto__` own property; an object literal would set the prototype.
    const hostile: unknown = JSON.parse('{"defaultAgent":"main","agents":[],"__proto__":{"polluted":true}}');
    const parsed = parseAgents(hostile);
    expect(parsed.defaultAgent).toBe('main');
    expect(parsed.agents).toHaveLength(0);
    expect((parsed as unknown as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call({}, 'polluted')).toBe(false);
  });

  it('rejects non-object health values without throwing', () => {
    for (const value of [null, undefined, false, 0, 'health', []]) {
      expect(() => parseHealth(value)).not.toThrow();
      expect(parseHealth(value).status).toBe('unknown');
    }
  });

  it('preserves order while bounding model payloads', () => {
    const parsed = parseModels({ models: ['z', null, 'a', 3, 'b', ...Array.from({ length: 220 }, (_, i) => `m-${i}`)] });
    expect(parsed.models[0]).toBe('z');
    expect(parsed.models[1]).toBe('a');
    expect(parsed.models[2]).toBe('b');
    expect(parsed.models).toHaveLength(200);
  });
});
