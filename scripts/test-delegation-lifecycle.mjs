import assert from 'node:assert/strict';
import { createAgentDelegator } from '../lib/agent-delegation.mjs';
import { createAgentLifecycle } from '../lib/agent-lifecycle.mjs';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

const primary = { id: 'hafize-general', name: 'Hafize', kind: 'primary', toolPolicy: { default: 'deny', allow: ['agent.delegate'] } };
const reviewer = { id: 'agency-code-reviewer', name: 'Code Reviewer', kind: 'specialist', toolPolicy: { default: 'deny', allow: ['repo.read'] } };
const registry = { defaultAgent: primary.id, policy: { maxDelegationDepth: 2, maxParallelAgents: 8 }, agents: [primary, reviewer] };
const task = 'Bu diffi incele.';

function build({ traceId, lifecycle, executeAgent }) {
  const runLedger = createAgentRunLedger({ traceId, agentId: primary.id });
  const delegator = createAgentDelegator({ registry, traceId, parentAgent: primary, parentTaskId: runLedger.rootTaskId, runLedger, lifecycle, executeAgent });
  return { runLedger, delegator };
}

/** Ledger'da yalnızca delegasyon kayıtlarının sonuç durumları. */
function statuses(runLedger) {
  return runLedger.snapshot().entries.filter((entry) => entry.action === 'agent.delegate').map((entry) => ({ status: entry.status, detail: entry.detail }));
}

// Geçersiz lifecycle sessizce yok sayılmaz.
assert.throws(() => build({ traceId: 'trace-invalid', lifecycle: { start: 1 }, executeAgent: async () => ({ ok: true }) }), /INVALID_DELEGATION_RUNTIME:lifecycle/);

// Başarılı delegasyon signal taşır, lifecycle koşusunu kapatır ve slot'u geri verir.
{
  const lifecycle = createAgentLifecycle({ maxConcurrent: 1 });
  const { runLedger, delegator } = build({
    traceId: 'trace-lifecycle-ok',
    lifecycle,
    executeAgent: async ({ signal }) => {
      assert.equal(signal instanceof AbortSignal, true);
      assert.equal(signal.aborted, false);
      assert.equal(lifecycle.activeCount, 1);
      return { ok: true, content: 'inceleme tamam' };
    }
  });
  const result = await delegator.delegate({ agentId: reviewer.id, task });

  assert.equal(result.value.content, 'inceleme tamam');
  assert.equal(lifecycle.activeCount, 0);
  assert.deepEqual(lifecycle.snapshot().runs.map((run) => run.state), ['completed']);
  assert.deepEqual(statuses(runLedger), [{ status: 'completed', detail: 'ok' }]);
}

// Başarısız alt koşu lifecycle'da da başarısız olarak kapanır.
{
  const lifecycle = createAgentLifecycle({ maxConcurrent: 1 });
  const { runLedger, delegator } = build({ traceId: 'trace-lifecycle-fail', lifecycle, executeAgent: async () => ({ ok: false, error: 'DELEGATED_TOOL_FAILED' }) });
  const failure = await delegator.delegate({ agentId: reviewer.id, task });
  const [run] = lifecycle.snapshot().runs;

  assert.deepEqual(failure, { ok: false, error: 'DELEGATED_TOOL_FAILED' });
  assert.equal(run.state, 'failed');
  assert.equal(run.reason, 'DELEGATED_TOOL_FAILED');
  assert.deepEqual(statuses(runLedger), [{ status: 'failed', detail: 'DELEGATED_TOOL_FAILED' }]);
}

// Koşu sırasında gelen iptal, geç dönen başarı sonucunu geçersiz kılar.
{
  const lifecycle = createAgentLifecycle({ maxConcurrent: 1 });
  const observed = [];
  const { runLedger, delegator } = build({
    traceId: 'trace-lifecycle-cancel',
    lifecycle,
    executeAgent: async ({ parentTaskId, signal }) => {
      lifecycle.cancel(parentTaskId, 'USER_STOPPED');
      observed.push(signal.aborted);
      return { ok: true, content: 'iptalden sonra gelen içerik' };
    }
  });
  const cancelled = await delegator.delegate({ agentId: reviewer.id, task });

  assert.deepEqual(cancelled, { ok: false, error: 'DELEGATION_CANCELLED' });
  assert.deepEqual(observed, [true]);
  assert.deepEqual(statuses(runLedger), [{ status: 'failed', detail: 'DELEGATION_CANCELLED' }]);
  assert.equal(lifecycle.read(runLedger.snapshot().entries[1].taskId).reason, 'USER_STOPPED');
}

// Eşzamanlılık bütçesi dolduğunda ikinci delegasyon hiç açılmaz.
{
  const lifecycle = createAgentLifecycle({ maxConcurrent: 1 });
  let inner = null;
  const { runLedger, delegator } = build({
    traceId: 'trace-lifecycle-concurrency',
    lifecycle,
    executeAgent: async () => {
      inner = inner ?? delegator.delegate({ agentId: reviewer.id, task: 'İkinci eşzamanlı görev.' });
      return { ok: true, content: 'ilk görev' };
    }
  });
  const first = await delegator.delegate({ agentId: reviewer.id, task });

  assert.equal(first.ok, true);
  assert.deepEqual(await inner, { ok: false, error: 'DELEGATION_CONCURRENCY_EXCEEDED' });
  assert.deepEqual(statuses(runLedger), [{ status: 'completed', detail: 'ok' }, { status: 'failed', detail: 'DELEGATION_CONCURRENCY_EXCEEDED' }]);
}

// Üst istek düştüyse yeni alt ajan hiç başlatılmaz.
{
  const parent = new AbortController();
  let executed = 0;
  const { runLedger, delegator } = build({
    traceId: 'trace-lifecycle-parent-abort',
    lifecycle: createAgentLifecycle({ maxConcurrent: 2, parentSignal: parent.signal }),
    executeAgent: async () => {
      executed += 1;
      return { ok: true, content: 'çalışmamalı' };
    }
  });
  parent.abort();

  assert.deepEqual(await delegator.delegate({ agentId: reviewer.id, task }), { ok: false, error: 'DELEGATION_CANCELLED' });
  assert.equal(executed, 0);
  assert.deepEqual(statuses(runLedger), [{ status: 'failed', detail: 'DELEGATION_CANCELLED' }]);
}

// Lifecycle verilmeyen mevcut çağrı yolu davranışını korur.
{
  const { runLedger, delegator } = build({
    traceId: 'trace-lifecycle-optional',
    lifecycle: null,
    executeAgent: async ({ signal }) => (signal === null ? { ok: true, content: 'eski akış' } : { ok: false, error: 'SIGNAL_LEAKED' })
  });
  const result = await delegator.delegate({ agentId: reviewer.id, task });

  assert.equal(result.value.content, 'eski akış');
  assert.deepEqual(statuses(runLedger), [{ status: 'completed', detail: 'ok' }]);
}

console.log('delegation lifecycle tests passed');
