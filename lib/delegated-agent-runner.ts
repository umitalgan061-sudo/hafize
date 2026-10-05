import { createAgentDelegator } from './agent-delegation.ts';
import { buildAgentSystemMessage } from './agent-runtime.ts';
import { normalizeNvidiaChatCompletion } from './model-response-contract.ts';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.ts';
import type { AgentDefinition, AgentRegistry } from './agent-runtime.ts';
import type { AgentRunLedger } from './agent-run-ledger.ts';

export interface DelegatedAgentRunInput {
  readonly agent?: AgentDefinition;
  readonly task?: unknown;
  readonly traceId?: unknown;
  readonly parentTaskId?: unknown;
  readonly depth?: number;
  readonly registry?: AgentRegistry;
  readonly runLedger?: AgentRunLedger;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly complete?: CompletionFn;
  readonly nvidiaConfigured?: boolean;
  readonly githubReadConfigured?: boolean;
  readonly githubReadFile?: unknown;
  readonly skillsRuntime?: unknown;
  readonly signal?: AbortSignal;
}

interface DelegatedToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: unknown };
}

interface DelegatedToolMessage {
  readonly role: 'tool';
  readonly tool_call_id: string;
  readonly name: string;
  readonly content: string;
}

type NormalizedCompletion = ReturnType<typeof normalizeNvidiaChatCompletion>;
type CompletionFn = (payload: unknown, signal?: AbortSignal) => Promise<unknown>;

function normalizeToolCalls(calls: unknown): DelegatedToolCall[] {
  if (!Array.isArray(calls)) return [];
  return calls.slice(0, 4)
    .filter((call): call is Record<string, unknown> =>
      Boolean(call && typeof call === 'object' && (call as Record<string, unknown>).id && (call as Record<string, unknown>).name)
    )
    .map((call) => ({
      id: String(call.id),
      type: 'function' as const,
      function: {
        name: String(call.name),
        arguments: call.arguments
      }
    }));
}

async function normalizeCompletion(complete: CompletionFn, payload: unknown, signal?: AbortSignal): Promise<NormalizedCompletion | null> {
  const response = await complete(payload, signal);
  try {
    return normalizeNvidiaChatCompletion(response);
  } catch {
    return null;
  }
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
  githubReadFile,
  skillsRuntime,
  signal
}: DelegatedAgentRunInput = {}) {
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
      githubReadFile,
      skillsRuntime
    })
  });
  const delegateAgent = (args: unknown) => nestedDelegator.delegate(args, { depth });
  const tools = getAllowedNvidiaTools(agent, {
    nvidiaConfigured: Boolean(nvidiaConfigured),
    githubReadConfigured: Boolean(githubReadConfigured),
    delegateAgent,
    skillsRuntime
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

  const first = await normalizeCompletion(complete, firstPayload, signal);
  if (!first) return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };

  const rawCalls = first.toolCalls;
  if (!rawCalls.length) {
    return { ok: true, content: first.content };
  }

  const calls = normalizeToolCalls(rawCalls);
  if (!calls.length) return { ok: false, error: 'INVALID_TOOL_CALL' };

  const toolMessages: DelegatedToolMessage[] = [];
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
  }, signal);
  if (!second) return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };
  if (anyToolFailed) return { ok: false, error: 'DELEGATED_TOOL_FAILED' };

  return {
    ok: true,
    content: second.content
  };
}
