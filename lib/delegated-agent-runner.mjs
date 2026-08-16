import { createAgentDelegator } from './agent-delegation.mjs';
import { buildAgentSystemMessage } from './agent-runtime.mjs';
import { checkNvidiaToolModel } from './model-provider-tool-boundary.mjs';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.mjs';

function normalizeToolCalls(calls) {
  if (!Array.isArray(calls)) return [];
  return calls.slice(0, 4).filter((call) => call?.id && call?.function?.name).map((call) => ({
    id: String(call.id),
    type: 'function',
    function: {
      name: String(call.function.name),
      arguments: typeof call.function.arguments === 'string' ? call.function.arguments : '{}'
    }
  }));
}

export async function runDelegatedAgent({
  agent,
  task,
  traceId,
  parentTaskId,
  depth = 1,
  signal = null,
  registry,
  runLedger,
  model,
  maxTokens = 2048,
  complete,
  nvidiaConfigured = false,
  githubReadConfigured = false,
  githubReadFile
} = {}) {
  if (!agent?.id || typeof task !== 'string' || !task.trim() || !traceId || !parentTaskId) {
    return { ok: false, error: 'INVALID_DELEGATED_RUN' };
  }
  if (!Number.isInteger(depth) || depth < 0) return { ok: false, error: 'INVALID_DELEGATED_DEPTH' };
  if (!registry || typeof runLedger?.recordToolStart !== 'function' || typeof complete !== 'function') {
    return { ok: false, error: 'INVALID_DELEGATED_RUN' };
  }
  if (signal?.aborted) return { ok: false, error: 'DELEGATION_CANCELLED' };
  const providerBoundary = checkNvidiaToolModel(model);
  if (!providerBoundary.ok) return { ok: false, error: providerBoundary.error };

  const nestedDelegator = createAgentDelegator({
    registry,
    traceId,
    parentAgent: agent,
    parentTaskId,
    parentSignal: signal,
    runLedger,
    executeAgent: ({
      agent: nestedAgent,
      task: nestedTask,
      traceId: nestedTraceId,
      depth: nestedDepth,
      parentTaskId: nestedParentTaskId,
      signal: nestedSignal
    }) => runDelegatedAgent({
      agent: nestedAgent,
      task: nestedTask,
      traceId: nestedTraceId,
      parentTaskId: nestedParentTaskId,
      depth: nestedDepth,
      signal: nestedSignal,
      registry,
      runLedger,
      model,
      maxTokens,
      complete,
      nvidiaConfigured,
      githubReadConfigured,
      githubReadFile
    })
  });
  const delegateAgent = (args) => nestedDelegator.delegate(args, { depth, signal });
  const tools = getAllowedNvidiaTools(agent, {
    nvidiaConfigured: Boolean(nvidiaConfigured),
    githubReadConfigured: Boolean(githubReadConfigured),
    delegateAgent
  });
  const messages = [buildAgentSystemMessage(agent, traceId), { role: 'user', content: task }];
  const firstPayload = {
    model,
    messages,
    stream: false,
    max_tokens: maxTokens
  };
  if (tools.length) {
    firstPayload.tools = tools;
    firstPayload.tool_choice = 'auto';
  }

  const first = await complete(firstPayload, signal);
  if (signal?.aborted) return { ok: false, error: 'DELEGATION_CANCELLED' };
  const assistant = first?.choices?.[0]?.message;
  if (!assistant || assistant.role !== 'assistant') return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };

  const rawCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
  if (!rawCalls.length) {
    return { ok: true, content: typeof assistant.content === 'string' ? assistant.content : '' };
  }

  const calls = normalizeToolCalls(rawCalls);
  if (!calls.length) return { ok: false, error: 'INVALID_TOOL_CALL' };

  const toolMessages = [];
  let anyToolFailed = false;
  for (const call of calls) {
    if (signal?.aborted) return { ok: false, error: 'DELEGATION_CANCELLED' };
    const toolTask = runLedger.recordToolStart(call.function.name, {
      parentTaskId,
      toolAgentId: agent.id
    });
    const result = await executeNvidiaToolCall(agent, call, {
      traceId,
      agent,
      registry,
      nvidiaConfigured: Boolean(nvidiaConfigured),
      githubReadConfigured: Boolean(githubReadConfigured),
      githubReadFile,
      delegateAgent,
      signal,
      approvalGranted: false
    });
    runLedger.recordToolFinish(toolTask.taskId, result);
    if (signal?.aborted) return { ok: false, error: 'DELEGATION_CANCELLED' };
    if (!result.ok) anyToolFailed = true;
    toolMessages.push({
      role: 'tool',
      tool_call_id: call.id,
      name: call.function.name,
      content: JSON.stringify(result)
    });
  }

  const second = await complete({
    model,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: typeof assistant.content === 'string' ? assistant.content : null,
        tool_calls: calls
      },
      ...toolMessages
    ],
    stream: false,
    max_tokens: maxTokens,
    tools,
    tool_choice: 'none'
  }, signal);
  if (signal?.aborted) return { ok: false, error: 'DELEGATION_CANCELLED' };
  const finalMessage = second?.choices?.[0]?.message;
  if (!finalMessage || finalMessage.role !== 'assistant') return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };
  if (anyToolFailed) return { ok: false, error: 'DELEGATED_TOOL_FAILED' };

  return {
    ok: true,
    content: typeof finalMessage.content === 'string' ? finalMessage.content : ''
  };
}
