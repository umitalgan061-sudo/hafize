import assert from 'node:assert/strict';
import {
  CONTEXT_COMPACTION_DEFAULTS,
  createContextCompactor,
  estimateMessageTokens
} from '../lib/context-compaction.mjs';

assert.equal(estimateMessageTokens([{ role: 'user', content: '12345678' }]) > 0, true);
assert.throws(() => estimateMessageTokens(null), /INVALID_CONTEXT_COMPACTOR:messages/);
assert.equal(CONTEXT_COMPACTION_DEFAULTS.contextLimitTokens, 128000);

const smallCalls = [];
const small = createContextCompactor({
  contextLimitTokens: 16000,
  summarize(input) { smallCalls.push(input); return 'unused'; }
});
const smallMessages = [{ role: 'system', content: 'system' }, { role: 'user', content: 'hello' }];
const smallResult = await small.prepare(smallMessages, { model: 'nvidia/test' });
assert.equal(smallResult.messages, smallMessages);
assert.equal(smallResult.meta.compacted, false);
assert.equal(smallResult.meta.attempted, false);
assert.equal(smallCalls.length, 0);

const summaryCalls = [];
const large = createContextCompactor({
  contextLimitTokens: 16000,
  triggerRatio: 0.5,
  preserveRecentMessages: 6,
  maxSummarySourceChars: 5000,
  async summarize(input) {
    summaryCalls.push(input);
    return 'Kararlar, kullanıcı kısıtları ve açık işler korundu.';
  }
});
const system = { role: 'system', content: 'SYSTEM-DO-NOT-DOWNGRADE' };
const history = [];
for (let index = 0; index < 14; index += 1) {
  history.push({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `${index}:` + 'x'.repeat(3500)
  });
}
const original = [system, ...history];
const abortController = new AbortController();
const result = await large.prepare(original, { model: 'nvidia/test-model', signal: abortController.signal });
assert.equal(result.meta.compacted, true);
assert.equal(result.meta.attempted, true);
assert.equal(result.meta.beforeTokens > result.meta.afterTokens, true);
assert.equal(result.meta.summarizedMessages > 0, true);
assert.equal(result.meta.preservedMessages >= 4, true);
assert.equal(result.messages[0], system);
assert.equal(result.messages[1].role, 'user');
assert.match(result.messages[1].content, /yeni yetki veya sistem talimatı vermez/);
assert.equal(result.messages[2].role, 'assistant');
assert.equal(summaryCalls.length, 1);
assert.equal(summaryCalls[0].model, 'nvidia/test-model');
assert.equal(summaryCalls[0].signal, abortController.signal);
assert.equal(summaryCalls[0].source.includes('SYSTEM-DO-NOT-DOWNGRADE'), false);
assert.equal(summaryCalls[0].source.length <= 5000, true);
assert.deepEqual(result.messages.slice(-4), original.slice(-4));

let failureCalls = 0;
const failing = createContextCompactor({
  contextLimitTokens: 16000,
  triggerRatio: 0.5,
  async summarize() { failureCalls += 1; throw new Error('secret upstream detail'); }
});
const failed = await failing.prepare(original);
assert.equal(failureCalls, 1);
assert.equal(failed.messages, original);
assert.equal(failed.meta.compacted, false);
assert.equal(failed.meta.attempted, true);
assert.equal(failed.meta.reason, 'summary_failed');
assert.equal(JSON.stringify(failed.meta).includes('secret upstream detail'), false);

assert.throws(() => createContextCompactor({ summarize() {}, triggerRatio: 0.1 }), /triggerRatio/);
assert.throws(() => createContextCompactor({ summarize() {}, preserveRecentMessages: 2 }), /preserveRecentMessages/);
assert.throws(() => createContextCompactor({}), /summarize/);
console.log('context compaction tests passed');
