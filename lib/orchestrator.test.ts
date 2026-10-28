import { describe, expect, it } from 'vitest';
import { openHafizeDb } from './hafize-db.ts';
import { bindArgs, createOrchestrator, validatePlan } from './orchestrator.ts';

const tools = [
  { name: 'web_search', description: 'arama', risk: 'low' as const },
  { name: 'code_run', description: 'kod', risk: 'low' as const },
  { name: 'shell_run', description: 'kabuk', risk: 'high' as const }
];
const names = new Set(tools.map((tool) => tool.name));

function fakeModels(criticDecision = 'continue') {
  return {
    chatJson: async ({ purpose }: { purpose?: string }) => (purpose === 'orchestrator.critic' ? { decision: criticDecision, reason: 'ok' } : { steps: [] }),
    chatText: async ({ purpose }: { purpose?: string }) => (purpose === 'orchestrator.synthesize' ? 'SONUÇ' : 'analiz')
  };
}

describe('plan validation', () => {
  it('rejects unknown tools, missing dependencies and cycles', () => {
    expect(() => validatePlan([{ id: 's1', tool: 'rm_rf' }], names, 5)).toThrow('PLAN_UNKNOWN_TOOL');
    expect(() => validatePlan([{ id: 's1', tool: 'web_search', dependsOn: ['s9'] }], names, 5)).toThrow('PLAN_UNKNOWN_DEPENDENCY');
    expect(() => validatePlan([{ id: 'a', tool: 'web_search', dependsOn: ['b'] }, { id: 'b', tool: 'web_search', dependsOn: ['a'] }], names, 5)).toThrow('PLAN_HAS_CYCLE');
    expect(validatePlan([{ id: 's1', tool: 'web_search' }, { id: 's2', tool: 'reason', dependsOn: ['s1'] }], names, 5)).toHaveLength(2);
  });

  it('binds outputs of earlier steps into arguments', () => {
    expect(bindArgs({ q: 'özet: {{s1}}', raw: '{{s1}}' }, { s1: { a: 1 } })).toEqual({ q: 'özet: {"a":1}', raw: { a: 1 } });
  });
});

describe('orchestrator', () => {
  it('runs a DAG in dependency order, retries failures and synthesizes a result', async () => {
    const db = openHafizeDb(':memory:');
    const orchestrator = createOrchestrator({ db, models: fakeModels() });
    const calls: string[] = [];
    let flaky = 0;
    const events: string[] = [];
    const state = await orchestrator.run({
      ownerId: 'u1', traceId: 't1', goal: 'iki şeyi ara ve hesapla', tools,
      initialPlan: [
        { id: 's1', tool: 'web_search', args: { query: 'a' } },
        { id: 's2', tool: 'web_search', args: { query: 'b' }, retryPolicy: { maxAttempts: 2, backoffMs: 0 } },
        { id: 's3', tool: 'code_run', args: { code: 'return 1', input: '{{s1}}' }, dependsOn: ['s1', 's2'] }
      ],
      executeTool: async (name, args) => {
        calls.push(`${name}:${JSON.stringify(args)}`);
        if (args.query === 'b' && flaky++ === 0) return { ok: false, error: 'TEMP' };
        return { ok: true, value: name === 'web_search' ? `sonuç-${args.query}` : 42 };
      },
      emit: (event) => events.push(event.type)
    });
    expect(state.status).toBe('succeeded');
    expect(state.finalAnswer).toBe('SONUÇ');
    expect(state.steps.s2).toMatchObject({ status: 'succeeded', attempts: 2 });
    expect(calls.at(-1)).toBe('code_run:{"code":"return 1","input":"sonuç-a"}');
    expect(events).toContain('step.retrying');
    expect(orchestrator.events(state.runId, 'u1').length).toBeGreaterThan(5);
    expect(() => orchestrator.get(state.runId, 'someone-else')).toThrow('RUN_NOT_FOUND');
  });

  it('enforces the step budget', async () => {
    const db = openHafizeDb(':memory:');
    const orchestrator = createOrchestrator({ db, models: fakeModels() });
    const state = await orchestrator.run({
      ownerId: 'u1', traceId: 't2', goal: 'çok adım', tools, budget: { maxSteps: 1 },
      initialPlan: [{ id: 's1', tool: 'web_search' }],
      executeTool: async () => ({ ok: true, value: 'x' })
    });
    expect(state.status).toBe('aborted');
    expect(state.abortReason).toBe('budget:maxSteps');
  });

  it('pauses high-risk steps until approved, then resumes from the checkpoint', async () => {
    const db = openHafizeDb(':memory:');
    const orchestrator = createOrchestrator({ db, models: fakeModels() });
    const executed: string[] = [];
    const executeTool = async (name: string) => { executed.push(name); return { ok: true, value: 'tamam' }; };
    const paused = await orchestrator.run({
      ownerId: 'u1', traceId: 't3', goal: 'komut çalıştır', tools,
      initialPlan: [{ id: 's1', tool: 'web_search' }, { id: 's2', tool: 'shell_run', args: { command: 'dir' }, dependsOn: ['s1'] }],
      executeTool
    });
    expect(paused.status).toBe('awaiting_approval');
    expect(executed).toEqual(['web_search']);
    const resumed = await orchestrator.resume({ ownerId: 'u1', runId: paused.runId, approveStepIds: ['s2'], tools, executeTool });
    expect(resumed.status).toBe('succeeded');
    expect(executed).toEqual(['web_search', 'shell_run']);
  });

  it('stops when the critic aborts and skips pending steps when it finishes early', async () => {
    const db = openHafizeDb(':memory:');
    const aborted = await createOrchestrator({ db, models: fakeModels('abort') }).run({
      ownerId: 'u1', traceId: 't4', goal: 'x', tools, initialPlan: [{ id: 's1', tool: 'web_search' }, { id: 's2', tool: 'web_search', dependsOn: ['s1'] }],
      executeTool: async () => ({ ok: true, value: 1 })
    });
    expect(aborted.status).toBe('aborted');
    const finished = await createOrchestrator({ db, models: fakeModels('finish') }).run({
      ownerId: 'u1', traceId: 't5', goal: 'x', tools, initialPlan: [{ id: 's1', tool: 'web_search' }, { id: 's2', tool: 'web_search', dependsOn: ['s1'] }],
      executeTool: async () => ({ ok: true, value: 1 })
    });
    expect(finished.status).toBe('succeeded');
    expect(finished.steps.s2).toMatchObject({ status: 'skipped', error: 'NOT_NEEDED' });
  });
});
