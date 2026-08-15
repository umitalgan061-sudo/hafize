import assert from 'node:assert/strict';
import { loadAgentRegistry } from '../lib/agent-runtime.mjs';
import { createContextCompactor } from '../lib/context-compaction.mjs';
import { createModelProviderChatPreparer } from '../lib/model-provider-chat-preparation.mjs';
import { createModelProviderContextCompactor } from '../lib/model-provider-context-compaction.mjs';

const registry = await loadAgentRegistry();
const messages = [];
for (let index = 0; index < 12; index += 1) {
  messages.push({
    role: index % 2 ? 'assistant' : 'user',
    content: `message-${index}:` + 'a'.repeat(4200)
  });
}

let defaultSummaryCalls = 0;
const base = createContextCompactor({
  contextLimitTokens: 16_000,
  triggerRatio: 0.5,
  preserveRecentMessages: 4,
  async summarize() {
    defaultSummaryCalls += 1;
    return 'nvidia summary should not serve local context';
  }
});

let localSummaryCalls = 0;
const localCapable = createModelProviderContextCompactor({
  baseCompactor: base,
  async complete(payload, { toolsRequired }) {
    localSummaryCalls += 1;
    assert.equal(payload.model, 'local:qwen3');
    assert.equal(toolsRequired, false);
    return {
      ok: true,
      status: 200,
      value: {
        provider: 'local',
        result: { choices: [{ message: { role: 'assistant', content: 'safe local summary' } }] }
      }
    };
  }
});

const preparer = createModelProviderChatPreparer({ registry, contextCompactor: localCapable });
const prepared = await preparer.prepare({
  model: 'local:qwen3',
  agentId: registry.defaultAgent,
  messages
});

assert.equal(prepared.payload.model, 'local:qwen3');
assert.equal(prepared.payload.stream, true);
assert.equal(prepared.headers['X-Hafize-Context-Compacted'], '1');
assert.ok(Number(prepared.headers['X-Hafize-Context-Tokens-After']) < Number(prepared.headers['X-Hafize-Context-Tokens-Before']));
assert.equal(localSummaryCalls, 1);
assert.equal(defaultSummaryCalls, 0);
assert.match(prepared.payload.messages[1].content, /safe local summary/);

const legacyPreparer = createModelProviderChatPreparer({ registry, contextCompactor: base });
await assert.rejects(
  () => legacyPreparer.prepare({ model: 'local:qwen3', agentId: registry.defaultAgent, messages }),
  (error) => {
    assert.equal(error.code, 'LOCAL_CONTEXT_COMPACTION_UNAVAILABLE');
    assert.equal(error.status, 413);
    return true;
  }
);
assert.equal(defaultSummaryCalls, 0, 'legacy local guard must still fail before the default summarizer');

console.log('local context preparation integration tests passed');
