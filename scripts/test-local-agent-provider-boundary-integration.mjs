import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';
import { createContextCompactor } from '../lib/context-compaction.mjs';
import { createModelProviderContextCompactor } from '../lib/model-provider-context-compaction.mjs';
import { runDelegatedAgent } from '../lib/delegated-agent-runner.mjs';

const shortMessages = [
  { role: 'system', content: 'system boundary' },
  { role: 'user', content: 'private local-only prompt' }
];
let baseSummaryCalls = 0;
const baseCompactor = createContextCompactor({
  contextLimitTokens: 16_000,
  async summarize() {
    baseSummaryCalls += 1;
    return 'nvidia summary must not run';
  }
});

await assert.rejects(
  () => baseCompactor.prepare(shortMessages, { model: 'local:qwen3' }),
  (error) => error?.code === 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED' && error?.status === 400
);
assert.equal(baseSummaryCalls, 0, 'base/NVIDIA compactor must reject local models before any summary call');

const providerCalls = [];
const providerAware = createModelProviderContextCompactor({
  baseCompactor,
  async complete(payload, options) {
    providerCalls.push({ payload, options });
    return {
      ok: true,
      status: 200,
      value: {
        provider: 'local',
        result: { choices: [{ message: { role: 'assistant', content: 'local summary' } }] }
      }
    };
  }
});

const shortLocal = await providerAware.prepare(shortMessages, { model: 'local:qwen3' });
assert.equal(shortLocal.meta.compacted, false);
assert.equal(providerCalls.length, 0, 'short local chat remains valid without provider work');

const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Read-only reviewer',
  toolPolicy: { default: 'deny', allow: ['repo.read'], deny: ['repo.write_branch', 'repo.merge'] }
};
const primary = {
  id: 'minimal-engineer',
  name: 'Minimal Engineer',
  kind: 'selector',
  description: 'Selector',
  toolPolicy: { default: 'deny', allow: ['agent.delegate'] }
};
const registry = { agents: [primary, reviewer] };
const ledger = createAgentRunLedger({ traceId: 'trace-local-boundary', agentId: primary.id });
let completionCalls = 0;
let githubCalls = 0;
const delegated = await runDelegatedAgent({
  agent: reviewer,
  task: 'Private local-only task',
  traceId: 'trace-local-boundary',
  parentTaskId: 'task-parent',
  registry,
  runLedger: ledger,
  model: 'local:qwen3',
  nvidiaConfigured: true,
  githubReadConfigured: true,
  githubReadFile: async () => {
    githubCalls += 1;
    return { content: 'must not run' };
  },
  complete: async () => {
    completionCalls += 1;
    return { choices: [{ message: { role: 'assistant', content: 'must not run' } }] };
  }
});

assert.deepEqual(delegated, { ok: false, error: 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED' });
assert.equal(completionCalls, 0, 'delegated local model must fail before NVIDIA completion');
assert.equal(githubCalls, 0, 'delegated local model must fail before any tool execution');
assert.equal(ledger.snapshot().entries.some((entry) => String(entry.action || '').startsWith('tool:')), false);

console.log('local agent provider boundary integration tests passed');
