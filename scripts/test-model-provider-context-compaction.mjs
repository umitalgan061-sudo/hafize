import assert from 'node:assert/strict';
import { createContextCompactor } from '../lib/context-compaction.mjs';
import { createModelProviderContextCompactor } from '../lib/model-provider-context-compaction.mjs';

function longConversation() {
  const messages = [{ role: 'system', content: 'system boundary' }];
  for (let index = 0; index < 12; index += 1) {
    messages.push({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${index}:` + 'x'.repeat(4200)
    });
  }
  return messages;
}

let defaultSummaries = 0;
const baseCompactor = createContextCompactor({
  contextLimitTokens: 16_000,
  triggerRatio: 0.5,
  preserveRecentMessages: 4,
  maxSummarySourceChars: 20_000,
  async summarize() {
    defaultSummaries += 1;
    return 'default provider summary';
  }
});

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
        result: {
          choices: [{ message: { role: 'assistant', content: 'local-only compact summary' } }]
        }
      }
    };
  }
});

assert.equal(providerAware.supportsLocalModels, true);
assert.equal(providerAware.thresholdTokens, baseCompactor.thresholdTokens);

const local = await providerAware.prepare(longConversation(), { model: 'local:qwen3' });
assert.equal(local.meta.compacted, true);
assert.equal(local.meta.attempted, true);
assert.ok(local.meta.afterTokens < local.meta.beforeTokens);
assert.equal(providerCalls.length, 1);
assert.equal(defaultSummaries, 0, 'local context must not fall through to the default/NVIDIA summarizer');
assert.equal(providerCalls[0].payload.model, 'local:qwen3');
assert.equal(providerCalls[0].payload.stream, false);
assert.equal(providerCalls[0].payload.max_tokens, 1200);
assert.equal(providerCalls[0].options.toolsRequired, false);
assert.match(providerCalls[0].payload.messages[0].content, /yerel bağlam özetleyicisisin/i);
assert.match(providerCalls[0].payload.messages[1].content, /Özetlenecek/);
assert.match(local.messages[1].content, /local-only compact summary/);

const nvidia = await providerAware.prepare(longConversation(), { model: 'meta/llama-3.1-70b-instruct' });
assert.equal(nvidia.meta.compacted, true);
assert.equal(defaultSummaries, 1);
assert.equal(providerCalls.length, 1, 'non-local context must keep the existing compactor path');
assert.match(nvidia.messages[1].content, /default provider summary/);

const shortLocal = await providerAware.prepare([
  { role: 'system', content: 'system' },
  { role: 'user', content: 'short question' }
], { model: 'local:qwen3' });
assert.equal(shortLocal.meta.compacted, false);
assert.equal(providerCalls.length, 1, 'short local context must not spend a summary request');

console.log('model provider context compaction tests passed');
