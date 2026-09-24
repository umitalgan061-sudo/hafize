import { createAgentDelegator } from './agent-delegation.mts';
import { buildAgentSystemMessage } from './agent-runtime.mts';
import { normalizeNvidiaChatCompletion } from './model-response-contract.mts';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.mts';

function normalizeToolCalls(calls: unknown) {
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

function normalizeCompletion(complete: Function, payload: unknown) {
  return complete(payload).then((response) => {
    try {
      return normalizeNvidiaChatCompletion(response);
    } catch {
      return null;
    }
  });
}

/**
 * Tek bir uzman ajanı, kendi araç izinleri ve izleme bağlamıyla çalıştırır.
 */
export async function runDelegatedAgent({ agent, task, traceId, parentTaskId, depth = 1, registry, runLedger, model, maxTokens = 2048, complete, nvidiaConfigured = false, githubReadConfigured = false, githubReadFile, skillsRuntime }: { agent?: { id?: string; [key: string]: any }; task?: string; traceId?: string; parentTaskId?: string; depth?: number; registry?: any; runLedger?: any; model?: string; maxTokens?: number; complete?: Function; nvidiaConfigured?: boolean; githubReadConfigured?: boolean; githubReadFile?: Function; skillsRuntime?: any; } = {}) {
  if (!agent?.id || typeof task !== 'string' || !task.trim() || !traceId || !parentTaskId) {
    return { ok: false as const, error: 'INVALID_DELEGATED_RUN' };
  }
  if (!Number.isInteger(depth) || depth < 0) return { ok: false as const, error: 'INVALID_DELEGATED_DEPTH' };
  if (!registry || typeof runLedger?.recordToolStart !== 'function' || typeof complete !== 'function') {
    return { ok: false as const, error: 'INVALID_DELEGATED_RUN' };
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
      githubReadFile,
      skillsRuntime
    })
  });
  const delegateAgent = (args) => nestedDelegator.delegate(args, { depth });
  const tools = getAllowedNvidiaTools(agent, {
    nvidiaConfigured: Boolean(nvidiaConfigured),
    githubReadConfigured: Boolean(githubReadConfigured),
    delegateAgent,
    skillsRuntime
  });
  const messages = [buildAgentSystemMessage(agent, traceId), { role: 'user', content: task }];
  // Araç alanları yalnızca ajanın aracı varsa eklenir.
  const firstPayload: {
    model: string;
    messages: unknown[];
    stream: false;
    max_tokens: number;
    tools?: unknown[];
    tool_choice?: string;
  } = {
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
  if (!first) return { ok: false as const, error: 'INVALID_NVIDIA_RESPONSE' };

  const rawCalls = first.toolCalls;
  if (!rawCalls.length) {
    return { ok: true as const, content: first.content };
  }

  const calls = normalizeToolCalls(rawCalls);
  if (!calls.length) return { ok: false as const, error: 'INVALID_TOOL_CALL' };

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
      approvalGranted: false,
      skillsRuntime
    });
    runLedger.recordToolFinish(toolTask.taskId, result);
    if (result.ok === false) anyToolFailed = true;
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
  if (!second) return { ok: false as const, error: 'INVALID_NVIDIA_RESPONSE' };
  if (anyToolFailed) return { ok: false as const, error: 'DELEGATED_TOOL_FAILED' };

  return {
    ok: true as const,
    content: second.content
  };
}
