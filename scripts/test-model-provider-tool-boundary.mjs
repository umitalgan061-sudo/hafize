import assert from 'node:assert/strict';
import {
  MODEL_PROVIDER_TOOL_BOUNDARY,
  assertNvidiaToolModel,
  checkNvidiaToolModel,
  isLocalModelId
} from '../lib/model-provider-tool-boundary.mjs';

assert.equal(MODEL_PROVIDER_TOOL_BOUNDARY.localModelPrefix, 'local:');
assert.equal(isLocalModelId('local:qwen3'), true);
assert.equal(isLocalModelId('  local:qwen3  '), true);
assert.equal(isLocalModelId('meta/llama-3.1-70b-instruct'), false);
assert.equal(isLocalModelId(null), false);
assert.equal(assertNvidiaToolModel('meta/llama-3.1-70b-instruct'), 'meta/llama-3.1-70b-instruct');

assert.throws(
  () => assertNvidiaToolModel('local:qwen3'),
  (error) => error?.code === 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED' && error?.status === 400
);
assert.deepEqual(checkNvidiaToolModel('local:qwen3'), {
  ok: false,
  error: 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED',
  status: 400
});
assert.deepEqual(checkNvidiaToolModel('nvidia/test'), { ok: true });

console.log('model provider tool boundary tests passed');
