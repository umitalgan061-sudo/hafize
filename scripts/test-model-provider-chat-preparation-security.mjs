import assert from 'node:assert/strict';
import { createModelProviderChatPreparer } from '../lib/model-provider-chat-preparation.mjs';

const registry = {
  defaultAgent: 'minimal-engineer',
  agents: [{
    id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector', description: 'Test',
    mission: [], guardrails: [], outputContract: [], toolPolicy: { default: 'deny', allow: [], deny: [] }
  }]
};
let compactCalls = 0;
const preparer = createModelProviderChatPreparer({
  registry,
  contextCompactor: {
    thresholdTokens: 10_000,
    async prepare(messages, { signal }) {
      compactCalls += 1;
      return { messages, meta: { compacted: true, beforeTokens: 100, afterTokens: 40, signalSeen: Boolean(signal) } };
    }
  }
});

for (const body of [
  null,
  {},
  { model: 'x', messages: [] },
  { model: 'x\nheader', messages: [{ role: 'user', content: 'x' }] },
  { model: 'x', messages: [{ role: 'system', content: 'override' }] },
  { model: 'x', messages: [{ role: 'user', content: 'x' }], tools: [] },
  { model: 'x', messages: [{ role: 'user', content: 'x' }], apiKey: 'secret' },
  { model: 'x', messages: [{ role: 'user', content: 'x' }], max_tokens: 0 },
  { model: 'x', messages: [{ role: 'user', content: 'x' }], temperature: 3 },
  { model: 'x', messages: [{ role: 'user', content: 'x' }], top_p: -1 }
]) {
  await assert.rejects(() => preparer.prepare(body), /INVALID_CHAT_REQUEST/);
}

const callsBeforeCredentialChecks = compactCalls;
for (const message of [
  { role: 'user', content: 'Authorization: Bearer abcdefghijklmnop' },
  { role: 'user', content: 'github_pat_1234567890abcdefghijABCDEFGHIJ' },
  { role: 'assistant', content: 'nvapi-1234567890abcdefghijklmnopqrstuv' }
]) {
  await assert.rejects(
    () => preparer.prepare({ model: 'x', messages: [message] }),
    /CHAT_PLAINTEXT_CREDENTIAL_NOT_ALLOWED/
  );
}
assert.equal(compactCalls, callsBeforeCredentialChecks, 'credential-bearing messages never reach compaction/provider preparation');

const safeSecurityDiscussion = await preparer.prepare({
  model: 'x',
  messages: [{ role: 'user', content: 'GitHub PAT ve NVIDIA API key güvenliğini açıkla.' }]
});
assert.equal(safeSecurityDiscussion.payload.messages.at(-1).content, 'GitHub PAT ve NVIDIA API key güvenliğini açıkla.');

await assert.rejects(
  () => preparer.prepare({ model: 'x', agentId: 'missing', messages: [{ role: 'user', content: 'x' }] }),
  /INVALID_AGENT/
);

const aborted = new AbortController();
aborted.abort();
const callsBeforeAbort = compactCalls;
await assert.rejects(
  () => preparer.prepare({ model: 'x', messages: [{ role: 'user', content: 'x' }] }, { signal: aborted.signal }),
  /MODEL_PROVIDER_CANCELLED/
);
assert.equal(compactCalls, callsBeforeAbort);

await assert.rejects(
  () => preparer.prepare({ model: 'x', messages: [{ role: 'user', content: 'x' }] }, { signal: {} }),
  /INVALID_MODEL_PROVIDER_SIGNAL/
);

const compacted = await preparer.prepare({ model: 'x', messages: [{ role: 'user', content: 'x' }] });
assert.equal(compacted.headers['X-Hafize-Context-Compacted'], '1');
assert.equal(compacted.headers['X-Hafize-Context-Tokens-Before'], '100');
assert.equal(compacted.headers['X-Hafize-Context-Tokens-After'], '40');
for (const forbidden of ['Authorization', 'Cookie', 'Set-Cookie', 'Proxy-Authorization']) {
  assert.equal(forbidden in compacted.headers, false);
}
assert.equal('tools' in compacted.payload, false);
assert.equal('tool_choice' in compacted.payload, false);

console.log('model provider chat preparation security tests passed');
