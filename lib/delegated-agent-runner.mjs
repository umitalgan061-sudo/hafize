import { createAgentDelegator } from './agent-delegation.mjs';
import { buildAgentSystemMessage } from './agent-runtime.mjs';
import { normalizeNvidiaChatCompletion } from './model-response-contract.mjs';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.mjs';

function normalizeToolCalls(calls) {
  if (!Array.isArray(calls)) return [];
  return calls.slice(0, 4).filter((call) => call?.id && call?.name).map((call) => ({
    id: String(call.id),
    type: 'function',
    function: {
      name: String(call.name),
      arguments: call.arguments
    }
  }));
}

function normalizeCompletion(complete, payload) {
  return complete(payload).then((response) => {
    try {
      return normalizeNvidiaChatCompletion(response);
    } catch {
      return null;
    }
  });
}

export async function runDelegatedAgent({
  agent,
  task,
  traceId,
  parentTaskId,
  depth = 1,
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

  const nestedDelegator = createAgentDelegator({
    registry,
    traceId,
    parentAgent: agent,
    parentTaskId,
    runLedger,
    executeAgent: ({
      agent: nestedAgent,
      task: nestedTask,
      traceId: nestedTraceId,
      depth: nestedDepth,
      parentTaskId: nestedParentTaskId
    }) => runDelegatedAgent({
      agent: nestedAgent,
      task: nestedTask,
      traceId: nestedTraceId,
      parentTaskId: nestedParentTaskId,
      depth: nestedDepth,
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
  const delegateAgent = (args) => nestedDelegator.delegate(args, { depth });
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

  const first = await normalizeCompletion(complete, firstPayload);
  if (!first) return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };

  const rawCalls = first.toolCalls;
  if (!rawCalls.length) {
    return { ok: true, content: first.content };
  }

  const calls = normalizeToolCalls(rawCalls);
  if (!calls.length) return { ok: false, error: 'INVALID_TOOL_CALL' };

  const toolMessages = [];
  let anyToolFailed = false;
  for (const call of calls) {
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
      approvalGranted: false
    });
    runLedger.recordToolFinish(toolTask.taskId, result);
    if (!result.ok) anyToolFailed = true;
    toolMessages.push({
      role: 'tool',
      tool_call_id: call.id,
      name: call.function.name,
      content: JSON.stringify(result)
    });
  }

  const second = await normalizeCompletion(complete, {
    model,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: first.content || null,
        tool_calls: calls
      },
      ...toolMessages
    ],
    stream: false,
    max_tokens: maxTokens,
    tools,
    tool_choice: 'none'
  });
  if (!second) return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };
  if (anyToolFailed) return { ok: false, error: 'DELEGATED_TOOL_FAILED' };

  return {
    ok: true,
    content: second.content
  };
}
