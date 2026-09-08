import assert from 'node:assert/strict';
import { normalizeNvidiaChatCompletion } from '../lib/model-response-contract.mjs';

function normalizeRootCompletion(response) {
  try {
    return normalizeNvidiaChatCompletion(response);
  } catch (error) {
    const normalized = new Error('INVALID_NVIDIA_RESPONSE');
    normalized.code = error?.message || 'INVALID_NVIDIA_RESPONSE';
    normalized.status = 502;
    throw normalized;
  }
}

const terminal = normalizeRootCompletion({
  id: 'resp-1',
  model: 'test-model',
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'hazır' } }]
});
assert.equal(terminal.content, 'hazır');
assert.equal(terminal.finishReason, 'stop');
assert.equal(terminal.toolCalls.length, 0);

const toolCallResponse = normalizeRootCompletion({
  id: 'resp-2',
  model: 'test-model',
  choices: [{
    finish_reason: 'tool_calls',
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'runtime_status', arguments: '{}' } }]
    }
  ]
});
assert.equal(toolCallResponse.finishReason, 'tool_calls');
assert.equal(toolCallResponse.toolCalls[0].name, 'runtime_status');

assert.throws(
  () => normalizeRootCompletion({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: { malformed: true } } }] }),
  (error) => error?.message === 'INVALID_NVIDIA_RESPONSE' && error?.code === 'INVALID_MODEL_CONTENT' && error?.status === 502
);

assert.throws(
  () => normalizeRootCompletion({ choices: [{ finish_reason: 7, message: { role: 'assistant', content: 'bad' } }] }),
  (error) => error?.message === 'INVALID_NVIDIA_RESPONSE' && error?.code === 'INVALID_MODEL_FINISH_REASON' && error?.status === 502
);

console.log('root model response contract tests passed');
