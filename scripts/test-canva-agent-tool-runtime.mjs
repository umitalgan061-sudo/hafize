import assert from 'node:assert/strict';
import { executeNvidiaToolCall, getAllowedNvidiaTools, listToolPermissions } from '../lib/tool-runtime.mjs';

const agent = {
  id: 'hafize-general',
  name: 'Hafize',
  toolPolicy: { default: 'deny', allow: ['connector.canva.read'] }
};
const calls = [];
const canvaReadTool = {
  async execute(args) {
    calls.push(args);
    return { design: { id: 'DAF123' } };
  }
};
const context = { canvaReadAuthenticated: true, canvaReadTool };

const allowed = getAllowedNvidiaTools(agent, context);
assert.deepEqual(allowed.map((tool) => tool.function.name), ['canva_read']);
assert.equal(JSON.stringify(allowed).includes('ownerId'), false);
assert.equal(JSON.stringify(allowed).includes('token'), false);
assert.equal(getAllowedNvidiaTools(agent, { canvaReadTool }).some((tool) => tool.function.name === 'canva_read'), false);
assert.equal(getAllowedNvidiaTools(agent, { canvaReadAuthenticated: true }).some((tool) => tool.function.name === 'canva_read'), false);
assert.equal(getAllowedNvidiaTools({ ...agent, toolPolicy: { default: 'deny', allow: [] } }, context).length, 0);

const result = await executeNvidiaToolCall(agent, {
  id: 'call_canva_1',
  type: 'function',
  function: { name: 'canva_read', arguments: JSON.stringify({ operation: 'design.get', params: { designId: 'DAF123' } }) }
}, { ...context, approvalGranted: false });
// The tool envelope also reports which tool ran and how long it took.
assert.equal(result.ok, true);
assert.equal(result.tool, 'canva_read');
assert.deepEqual(result.value, { design: { id: 'DAF123' } });
assert.equal(Number.isFinite(result.durationMs), true);
assert.deepEqual(calls[0], { operation: 'design.get', params: { designId: 'DAF123' } });

{
  const failure = await executeNvidiaToolCall(agent, {
  id: 'call_canva_2',
  type: 'function',
  function: { name: 'canva_read', arguments: '{}' }
}, { canvaReadTool, canvaReadAuthenticated: false });
  assert.equal(failure.ok, false);
  assert.equal(failure.error, 'TOOL_UNAVAILABLE');
}
{
  const failure = await executeNvidiaToolCall(agent, {
  id: 'call_canva_3',
  type: 'function',
  function: { name: 'canva_read', arguments: '[]' }
}, context);
  assert.equal(failure.ok, false);
  assert.equal(failure.error, 'INVALID_TOOL_ARGUMENTS');
}
assert.equal('principal' in context, false);
assert.equal(listToolPermissions().some((item) => item.permission === 'connector.canva.read' && item.name === 'canva_read'), true);
console.log('canva agent tool runtime tests passed');
