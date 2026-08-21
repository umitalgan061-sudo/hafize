import assert from 'node:assert/strict';
import { executeNvidiaToolCall } from '../lib/tool-runtime.mjs';
import { TOOL_EXECUTION_RESULT_POLICY } from '../lib/tool-execution-result-policy.mjs';

const allowGmailAgent = Object.freeze({
  id: 'test-agent',
  name: 'Test Agent',
  toolPolicy: Object.freeze({
    default: 'deny',
    allow: Object.freeze(['connector.gmail.read'])
  })
});

function gmailCall(argumentsValue = '{}') {
  return {
    id: 'call-1',
    type: 'function',
    function: { name: 'gmail_read', arguments: argumentsValue }
  };
}

function context(execute, extra = {}) {
  return {
    gmailReadAuthenticated: true,
    gmailReadTool: { execute },
    approvalGranted: false,
    ...extra
  };
}

{
  const source = { profile: { emailAddress: 'user@example.com' }, messages: ['a', 'b'] };
  const result = await executeNvidiaToolCall(allowGmailAgent, gmailCall('{"operation":"profile.get"}'), context(async () => source));
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, source);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.profile), true);
  source.profile.emailAddress = 'mutated@example.com';
  assert.equal(result.value.profile.emailAddress, 'user@example.com');
  assert.doesNotThrow(() => JSON.stringify(result));
}

{
  const circular = { id: 'message' };
  circular.self = circular;
  const result = await executeNvidiaToolCall(allowGmailAgent, gmailCall(), context(async () => circular));
  assert.deepEqual(result, { ok: false, error: 'TOOL_RESULT_CIRCULAR' });
  assert.doesNotThrow(() => JSON.stringify(result));
}

{
  let getterReads = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'body', {
    enumerable: true,
    get() {
      getterReads += 1;
      return 'secret';
    }
  });
  const result = await executeNvidiaToolCall(allowGmailAgent, gmailCall(), context(async () => hostile));
  assert.deepEqual(result, { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.equal(getterReads, 0);
}

{
  const result = await executeNvidiaToolCall(
    allowGmailAgent,
    gmailCall(),
    context(async () => ({ content: 'x'.repeat(TOOL_EXECUTION_RESULT_POLICY.maxJsonBytes + 1) }))
  );
  assert.deepEqual(result, { ok: false, error: 'TOOL_RESULT_TOO_LARGE' });
}

{
  let codeReads = 0;
  const result = await executeNvidiaToolCall(allowGmailAgent, gmailCall(), context(async () => {
    const error = new Error('provider leaked details');
    Object.defineProperty(error, 'code', {
      get() {
        codeReads += 1;
        return 'SHOULD_NOT_RUN';
      }
    });
    throw error;
  }));
  assert.deepEqual(result, { ok: false, error: 'TOOL_EXECUTION_FAILED' });
  assert.equal(codeReads, 0, 'thrown error accessors are not invoked');
}

{
  const error = new Error('safe internal error');
  error.code = 'GMAIL_READ_FAILED';
  error.status = 503;
  const result = await executeNvidiaToolCall(allowGmailAgent, gmailCall(), context(async () => { throw error; }));
  assert.deepEqual(result, { ok: false, error: 'GMAIL_READ_FAILED', status: 503 });
}

{
  const deniedAgent = {
    id: 'denied',
    toolPolicy: { default: 'deny', allow: [] }
  };
  let called = false;
  const result = await executeNvidiaToolCall(deniedAgent, gmailCall(), context(async () => {
    called = true;
    return { shouldNot: 'run' };
  }));
  assert.deepEqual(result, { ok: false, error: 'TOOL_NOT_AUTHORIZED', reason: 'default_deny' });
  assert.equal(called, false);
  assert.equal(Object.isFrozen(result), true);
}

{
  const result = await executeNvidiaToolCall(allowGmailAgent, gmailCall('['), context(async () => ({ ok: true })));
  assert.deepEqual(result, { ok: false, error: 'INVALID_TOOL_ARGUMENTS' });
}

{
  const controller = new AbortController();
  controller.abort('user-left');
  let called = false;
  const result = await executeNvidiaToolCall(allowGmailAgent, gmailCall(), context(async () => {
    called = true;
    return { ok: true };
  }, { signal: controller.signal }));
  assert.deepEqual(result, { ok: false, error: 'TOOL_EXECUTION_CANCELLED' });
  assert.equal(called, false);
}

{
  const controller = new AbortController();
  let release;
  let handlerResolved = false;
  const pending = executeNvidiaToolCall(allowGmailAgent, gmailCall(), context(async () => {
    await new Promise((resolve) => { release = resolve; });
    handlerResolved = true;
    return { late: 'value' };
  }, { signal: controller.signal }));
  await Promise.resolve();
  controller.abort('closed');
  const result = await pending;
  assert.deepEqual(result, { ok: false, error: 'TOOL_EXECUTION_CANCELLED' });
  release();
  await Promise.resolve();
  assert.equal(handlerResolved, true, 'underlying shared work may finish but cannot change the settled tool result');
}

console.log('tool runtime result boundary tests passed');
