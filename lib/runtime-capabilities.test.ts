import { describe, expect, it } from 'vitest';
import { budgetSnapshot, capabilitySnapshot, formatCapabilityAnswer, isStandaloneCapabilityQuestion } from './runtime-capabilities.ts';
import { getAllowedNvidiaTools, getRuntimeCapabilities, executeNvidiaToolCall, listToolPermissions } from './tool-runtime.ts';
import { createAgentRunLedger } from './agent-run-ledger.ts';

const agent = { id: 'primary', name: 'Hafize', toolPolicy: { default: 'deny' as const, allow: ['runtime.status', 'repo.read'], deny: [], approvalRequired: [] } };
const budget = { maxToolRounds: 100, roundsStarted: 5, toolCallsCompleted: 12, timeoutMs: 1800000, elapsedMs: 12000, expertMaxRounds: 8, maxCallsPerRound: 8 };
describe('authoritative runtime awareness', () => {
  it('reports exact advertised names rather than the entire catalog', async () => {
    const context = { traceId: 'trace', agent, registry: { agents: [agent] }, runtimeBudget: () => budget };
    const names = getAllowedNvidiaTools(agent, context).map(t => t.function.name);
    const snapshot = getRuntimeCapabilities(agent, { ...context, advertisedToolNames: names });
    expect(snapshot.availableTools).toEqual(names);
    expect(snapshot.catalogSize).toBe(listToolPermissions().length);
    expect(snapshot.unavailableTools.find(t => t.name === 'github_read_file')?.state).toBe('unavailable');
    expect(snapshot.budget?.roundsRemaining).toBe(95);
    expect(snapshot.budget?.totalCallCeiling).toBe(800);
    const result = await executeNvidiaToolCall(agent, { id: 'c1', function: { name: 'runtime_status', arguments: '{}' } }, context);
    expect(result).toMatchObject({ ok: true, value: { capabilities: { availableTools: names, budget: { maxToolRounds: 100 } } } });
  });
  it('never treats an unadvertised tool as active', () => {
    const snapshot = getRuntimeCapabilities(agent, { traceId: 'trace', agent, advertisedToolNames: [] });
    expect(snapshot.availableToolCount).toBe(0);
    expect(snapshot.budget).toBeNull();
  });
  it('has truthful bounded counters', () => {
    expect(budgetSnapshot({ ...budget, elapsedMs: 2000000, roundsStarted: 100 })).toMatchObject({ roundsRemaining: 0, remainingMs: 0, completionGuaranteed: false });
    const answer = formatCapabilityAnswer(capabilitySnapshot([{ name: 'runtime_status', state: 'available' }], budget, 13));
    expect(answer).toContain('100');
    expect(answer).toContain('800');
    expect(answer).toContain('12 (ana asistan dahil toplam 13)');
    expect(answer).toContain('sınırsız değildir');
  });
  it('only intercepts standalone capacity questions', () => {
    for (const q of ['Şuan kaç tane araç çağrısı yapabiliyorsun?', 'Şu an kaç aracın var?', 'Aktif araç listesini göster', 'Araç turu sınırın kaç?']) expect(isStandaloneCapabilityQuestion(q)).toBe(true);
    for (const q of ['Araçlarını göster ve depoyu değiştir', 'Kaç araç kullanabiliyorsun? Sonra kodu yayınla.', '100 tur yap', '']) expect(isStandaloneCapabilityQuestion(q)).toBe(false);
  });
  it('records a full 100-round eight-call run without ledger exhaustion', () => {
    const ledger = createAgentRunLedger({ traceId: 'large-run', agentId: 'primary', maxEntries: 2048, now: () => 0 });
    for (let index = 0; index < 800; index++) {
      const entry = ledger.recordToolStart('runtime_status');
      ledger.recordToolFinish(entry.taskId, { ok: true });
    }
    expect(ledger.snapshot().entries.length).toBe(801);
    expect(ledger.finish({ ok: true }).status).toBe('completed');
  });
  it('does not execute a tool after request cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    const result = await executeNvidiaToolCall(agent, { id: 'c1', function: { name: 'runtime_status', arguments: '{}' } }, { traceId: 'trace', agent, signal: controller.signal });
    expect(result).toMatchObject({ ok: false, error: 'TOOL_ABORTED' });
  });
});
