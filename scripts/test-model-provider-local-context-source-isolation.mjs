import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/model-provider-chat-preparation.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../lib/model-provider-http-api.mjs', import.meta.url), 'utf8');

assert.match(source, /LOCAL_MODEL_PREFIX = 'local:'/);
assert.match(source, /LOCAL_CONTEXT_COMPACTION_UNAVAILABLE/);
assert.match(source, /estimateMessageTokens\(messages\) <= thresholdTokens/);
assert.match(source, /rejectUnsupportedLocalCompaction\(model, conversation, compactor\.thresholdTokens\)/);

const guardIndex = source.indexOf('rejectUnsupportedLocalCompaction(model, conversation, compactor.thresholdTokens)');
const compactIndex = source.indexOf('compactor.prepare(conversation, { model, signal })');
assert.ok(guardIndex >= 0 && compactIndex > guardIndex, 'local guard must execute before compactor.prepare');

for (const forbidden of [
  'NVIDIA_API_KEY',
  'Authorization',
  'Bearer ',
  'process.env',
  'globalThis.fetch',
  'child_process',
  'exec(',
  'spawn(',
  'shell=True',
  'localStorage',
  'sessionStorage'
]) {
  assert.equal(source.includes(forbidden), false, `chat preparation must stay provider/secret isolated: ${forbidden}`);
}

assert.match(http, /LOCAL_CONTEXT_COMPACTION_UNAVAILABLE/);
assert.match(http, /status: 413/);
assert.doesNotMatch(http, /error\.detail|error\.stack|JSON\.stringify\(error\)/);

const errorBody = "body: { error: typeof result?.error === 'string' ? result.error : 'MODEL_PROVIDER_FAILED' }";
assert.equal(http.includes(errorBody), true);
assert.equal(http.includes('Authorization: `Bearer'), false);
assert.equal(http.includes('NVIDIA_API_KEY'), false);

console.log('model provider local context source isolation tests passed');
