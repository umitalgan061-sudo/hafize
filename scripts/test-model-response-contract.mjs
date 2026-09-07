import assert from 'node:assert/strict';
import { MODEL_RESPONSE_CONTRACT, isTerminalModelResponse, normalizeModelResponse, normalizeNvidiaChatCompletion } from '../lib/model-response-contract.mjs';

const response = normalizeModelResponse({ content: 'hazır', finishReason: 'stop', model: 'test-model', responseId: 'resp-1', usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 }, toolCalls: [] });
assert.equal(response.content, 'hazır');
assert.equal(response.finishReason, 'stop');
assert.equal(response.usage.total_tokens, 14);
assert.equal(response.model, 'test-model');
assert.equal(isTerminalModelResponse(response), true);

const toolResponse = normalizeModelResponse({ finishReason: 'tool_calls', toolCalls: [{ id: 'call-1', function: { name: 'runtime_status', arguments: '{}' } }] });
assert.equal(toolResponse.toolCalls.length, 1);
assert.equal(isTerminalModelResponse(toolResponse), false);

const providerResponse = normalizeNvidiaChatCompletion({
  id: 'resp-provider-1',
  model: 'test-model',
  choices: [{
    finish_reason: 'tool_calls',
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: 'call-provider-1',
        function: { name: 'github_read_file', arguments: '{"path":"README.md"}' }
      }]
    }
  }],
  usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 }
});
assert.equal(providerResponse.content, '');
assert.equal(providerResponse.finishReason, 'tool_calls');
assert.equal(providerResponse.toolCalls[0].name, 'github_read_file');
assert.equal(providerResponse.toolCalls[0].arguments, '{"path":"README.md"}');
assert.equal(providerResponse.responseId, 'resp-provider-1');
assert.equal(providerResponse.usage.total_tokens, 28);

assert.throws(() => normalizeNvidiaChatCompletion({ choices: [{ message: { role: 'user', content: 'bad' } }] }), /INVALID_MODEL_RESPONSE/);
assert.throws(() => normalizeNvidiaChatCompletion({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'x', function: { name: 'x', arguments: 'x'.repeat(MODEL_RESPONSE_CONTRACT.maxToolArgumentLength + 1) } }] } }] }), /INVALID_MODEL_TOOL_CALL/);
assert.throws(() => normalizeNvidiaChatCompletion({ choices: [{ message: { role: 'assistant', tool_calls: Array.from({ length: MODEL_RESPONSE_CONTRACT.maxToolCalls + 1 }, () => ({ id: 'x', function: { name: 'x', arguments: '{}' } })) } }] }), /INVALID_MODEL_TOOL_CALLS/);

assert.equal(normalizeModelResponse({ finishReason: 'future-provider-value' }).finishReason, 'unknown');
assert.throws(() => normalizeModelResponse({ content: 'x'.repeat(MODEL_RESPONSE_CONTRACT.maxContentLength + 1) }), /MODEL_CONTENT_TOO_LARGE/);
assert.throws(() => normalizeModelResponse({ toolCalls: Array.from({ length: 17 }, () => ({ id: 'x', function: { name: 'x', arguments: '{}' } })) }), /INVALID_MODEL_TOOL_CALLS/);
assert.throws(() => normalizeModelResponse({ usage: { total_tokens: -1 } }), /INVALID_MODEL_USAGE/);
assert.throws(() => normalizeModelResponse({ toolCalls: [{ id: '', function: { name: 'x', arguments: '{}' } }] }), /INVALID_MODEL_TOOL_CALL_ID/);

console.log('model response contract tests passed');
