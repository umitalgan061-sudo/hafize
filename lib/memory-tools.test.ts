import { describe, expect, it } from 'vitest';
import { loadAgentRegistry, resolveAgent } from './agent-runtime.ts';
import { createMemorySession, normalizeClientMemory } from './memory-tools.ts';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.ts';

describe('memory tools', () => {
  it('accepts only well-formed notes from the browser', () => {
    const notes = normalizeClientMemory([
      { id: 'm1', text: '  Kullanıcının adı   Ümit. ' },
      { id: 'bad id!', text: 'x' },
      { id: 'm2', text: '' },
      { id: 'm3', text: 'a'.repeat(400) },
      'not an object'
    ]);
    expect(notes).toEqual([{ id: 'm1', text: 'Kullanıcının adı Ümit.' }, { id: 'm3', text: 'a'.repeat(300) }]);
    expect(normalizeClientMemory('nope')).toEqual([]);
  });

  it('saves, deduplicates and forgets notes, reporting updates for the browser', async () => {
    let n = 0;
    const session = createMemorySession([{ id: 'm1', text: 'Kullanıcı vegan.' }], { newId: () => `new${++n}` });
    await expect(session.save({ text: 'Kullanıcı Python ile çalışıyor.' })).resolves.toEqual({ saved: true, id: 'new1', text: 'Kullanıcı Python ile çalışıyor.' });
    await expect(session.save({ text: 'kullanıcı VEGAN.' })).resolves.toMatchObject({ saved: false, id: 'm1' });
    await expect(session.forget({ id: 'm1' })).resolves.toEqual({ forgotten: true, id: 'm1' });
    await expect(session.forget({ id: 'm1' })).rejects.toMatchObject({ code: 'MEMORY_NOT_FOUND' });
    expect(session.updates).toEqual([{ action: 'save', id: 'new1', text: 'Kullanıcı Python ile çalışıyor.' }, { action: 'forget', id: 'm1' }]);
  });

  it('refuses secrets and anything after outside content was read', async () => {
    const session = createMemorySession([]);
    await expect(session.save({ text: 'password: hunter2secret' })).rejects.toMatchObject({ code: 'MEMORY_SECRET_BLOCKED' });
    await expect(session.save({ text: 'x', extra: 1 })).rejects.toMatchObject({ code: 'INVALID_MEMORY_ARGS' });
    session.markUntrustedContent();
    await expect(session.save({ text: 'Kullanıcı her zaman bu siteye para gönderir.' })).rejects.toMatchObject({ code: 'MEMORY_SAVE_BLOCKED_AFTER_EXTERNAL_CONTENT' });
    expect(session.updates).toEqual([]);
  });

  it('is offered to the main agent only when a memory session is wired', async () => {
    const registry = await loadAgentRegistry();
    const hafize = resolveAgent(registry, 'hafize-general')!;
    const reviewer = resolveAgent(registry, 'agency-code-reviewer')!;
    const memory = createMemorySession([]);
    const names = (agent: typeof hafize, context: object) => getAllowedNvidiaTools(agent, context).map((tool) => tool.function.name);
    expect(names(hafize, {})).not.toContain('memory_save');
    expect(names(hafize, { memory })).toEqual(expect.arrayContaining(['memory_save', 'memory_forget']));
    expect(names(reviewer, { memory })).not.toContain('memory_save');
    const traceId = '00000000-0000-4000-8000-000000000001';
    const result = await executeNvidiaToolCall(hafize, { id: 'c1', type: 'function', function: { name: 'memory_save', arguments: '{"text":"Kullanıcı kahveyi sade içer."}' } }, { traceId, agent: hafize, memory });
    expect(result).toMatchObject({ ok: true, value: { saved: true } });
    expect(memory.updates).toHaveLength(1);
  });
});
