import assert from 'node:assert/strict';
import { executeNvidiaToolCall, getAllowedNvidiaTools, listToolPermissions } from '../lib/tool-runtime.mjs';

const agent = {
  id: 'hafize-general',
  name: 'Hafize',
  toolPolicy: { default: 'deny', allow: ['connector.gmail.read'] }
};
const calls = [];
const gmailReadTool = {
  async execute(args) {
    calls.push(args);
    return { messages: [{ id: 'm1' }] };
  }
};
const context = { gmailReadAuthenticated: true, gmailReadTool };

const allowed = getAllowedNvidiaTools(agent, context);
assert.deepEqual(allowed.map((tool) => tool.function.name), ['gmail_read']);
assert.equal(JSON.stringify(allowed).includes('ownerId'), false);
assert.equal(JSON.stringify(allowed).includes('token'), false);
assert.equal(getAllowedNvidiaTools(agent, { gmailReadTool }).some((tool) => tool.function.name === 'gmail_read'), false);
assert.equal(getAllowedNvidiaTools(agent, { gmailReadAuthenticated: true }).some((tool) => tool.function.name === 'gmail_read'), false);
assert.equal(getAllowedNvidiaTools({ ...agent, toolPolicy: { default: 'deny', allow: [] } }, context).length, 0);

const result = await executeNvidiaToolCall(agent, {
  function: { name: 'gmail_read', arguments: JSON.stringify({ operation: 'message.get', params: { messageId: 'm1' } }) }
}, { ...context, approvalGranted: false });
assert.deepEqual(result, { ok: true, value: { messages: [{ id: 'm1' }] } });
assert.deepEqual(calls[0], { operation: 'message.get', params: { messageId: 'm1' } });

assert.deepEqual(await executeNvidiaToolCall(agent, {
  function: { name: 'gmail_read', arguments: '{}' }
}, { gmailReadTool, gmailReadAuthenticated: false }), { ok: false, error: 'TOOL_UNAVAILABLE' });
assert.deepEqual(await executeNvidiaToolCall(agent, {
  function: { name: 'gmail_read', arguments: '[]' }
}, context), { ok: false, error: 'INVALID_TOOL_ARGUMENTS' });
assert.equal(listToolPermissions().some((item) => item.permission === 'connector.gmail.read' && item.functionName === 'gmail_read'), true);
console.log('gmail agent tool runtime tests passed');