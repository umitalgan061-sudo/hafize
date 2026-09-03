import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';
import { runDelegatedAgent } from '../lib/delegated-agent-runner.mjs';

const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Salt-okunur inceleme ajanı.',
  toolPolicy: { default: 'deny', allow: ['repo.read'], deny: ['repo.write_branch'] }
};
const primary = {
  id: 'hafize-general',
  name: 'Hafize',
  kind: 'primary',
  description: 'Ana ajan.',
  toolPolicy: { default: 'deny', allow: ['runtime.status', 'agent.delegate'] }
};
const registry = { agents: [primary, reviewer] };

function baseRun(overrides = {}) {
  const ledger = createAgentRunLedger({ traceId: 'trace-cancel', agentId: primary.id });
  const delegation = ledger.recordDelegationStart(reviewer.id);
  return {
    ledger,
    options: {
      agent: reviewer,
      task: 'README dosyasını incele.',
      traceId: 'trace-cancel',
      parentTaskId: delegation.taskId,
      registry,
      runLedger: ledger,
      model: 'mock-model',
      githubReadConfigured: true,
      githubReadFile: async (args) => ({ ...args, content: '# Hafize', truncated: false }),
      complete: async () => ({ choices: [{ message: { role: 'assistant', content: 'tamam' } }] }),
      ...overrides
    }
  };
}

// Geçersiz iptal parametreleri sözleşmeye uygun hata döndürür.
for (const signal of ['abort', 42, {}]) {
  const { options } = baseRun({ signal });
  assert.deepEqual(await runDelegatedAgent(options), { ok: false, error: 'INVALID_DELEGATED_SIGNAL' });
}
for (const timeoutMs of [0, 999, 600_001, 1.5, '5000']) {
  const { options } = baseRun({ timeoutMs });
  assert.deepEqual(await runDelegatedAgent(options), { ok: false, error: 'INVALID_DELEGATED_TIMEOUT' });
}

// Sinyal ve zaman aşımı verilmediğinde davranış değişmez.
assert.deepEqual(await runDelegatedAgent(baseRun().options), { ok: true, content: 'tamam' });
assert.deepEqual(await runDelegatedAgent(baseRun({ signal: null, timeoutMs: null }).options), {
  ok: true,
  content: 'tamam'
});

// Tur başlamadan iptal edilmişse model hiç çağrılmaz.
const preAborted = new AbortController();
preAborted.abort();
let calls = 0;
const preResult = await runDelegatedAgent(baseRun({
  signal: preAborted.signal,
  complete: async () => { calls += 1; return { choices: [{ message: { role: 'assistant', content: 'x' } }] }; }
}).options);
assert.deepEqual(preResult, { ok: false, error: 'DELEGATED_RUN_ABORTED' });
assert.equal(calls, 0);

// Model çağrısı sırasında iptal: ham AbortError sızmaz, sinyal complete'e geçirilir.
const midRun = new AbortController();
let receivedSignal = null;
const midResult = await runDelegatedAgent(baseRun({
  signal: midRun.signal,
  complete: async (payload, signal) => {
    receivedSignal = signal;
    midRun.abort();
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  }
}).options);
assert.deepEqual(midResult, { ok: false, error: 'DELEGATED_RUN_ABORTED' });
assert.equal(receivedSignal instanceof AbortSignal, true);

// İptal edilmemişken gerçek hata yutulmaz.
await assert.rejects(
  () => runDelegatedAgent(baseRun({
    signal: new AbortController().signal,
    complete: async () => { throw new Error('UPSTREAM_DOWN'); }
  }).options),
  /UPSTREAM_DOWN/
);

// Zaman aşımı ayrı hata koduyla döner ve kalan araç çağrıları başlatılmaz.
const timeoutLedger = baseRun({
  timeoutMs: 1_000,
  complete: async (payload, signal) => {
    if (payload.tool_choice === 'auto') {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' }
            }]
          }
        }]
      };
    }
    await new Promise((resolve) => { signal.addEventListener('abort', resolve, { once: true }); });
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  }
});
const started = Date.now();
const timeoutResult = await runDelegatedAgent(timeoutLedger.options);
assert.deepEqual(timeoutResult, { ok: false, error: 'DELEGATED_RUN_TIMEOUT' });
assert.ok(Date.now() - started >= 900, 'zaman aşımı erken tetiklendi');
const toolEntries = timeoutLedger.ledger.snapshot().entries.filter((entry) => entry.action.startsWith('tool:'));
assert.equal(toolEntries.length, 1);
assert.equal(toolEntries[0].status, 'completed', 'araç kaydı askıda kaldı');

// Araç turunda iptal edilirse ikinci model çağrısı yapılmaz.
const toolAbort = new AbortController();
let modelCalls = 0;
const abortDuringTools = await runDelegatedAgent(baseRun({
  signal: toolAbort.signal,
  githubReadFile: async (args) => {
    toolAbort.abort();
    return { ...args, content: '# Hafize', truncated: false };
  },
  complete: async (payload) => {
    modelCalls += 1;
    if (payload.tool_choice === 'auto') {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"a.md"}' } },
              { id: 'c2', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"b.md"}' } }
            ]
          }
        }]
      };
    }
    return { choices: [{ message: { role: 'assistant', content: 'bitti' } }] };
  }
}).options);
assert.deepEqual(abortDuringTools, { ok: false, error: 'DELEGATED_RUN_ABORTED' });
assert.equal(modelCalls, 1, 'iptalden sonra ikinci model çağrısı yapılmamalı');

console.log('delegated run cancellation OK: geçersiz sinyal/timeout reddi, ön iptal, model iptali, araç turu iptali ve zaman aşımı ayrı kodla raporlanıyor');
