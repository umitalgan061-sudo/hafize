import { completionOrigin } from './model-response-origin.ts';
import { createAgentDelegator } from './agent-delegation.ts';
import { buildAgentSystemMessage } from './agent-runtime.ts';
import { normalizeNvidiaChatCompletion } from './model-response-contract.ts';
import { executeNvidiaToolCall, getAllowedNvidiaTools, getRuntimeCapabilities, type ToolRuntimeContext } from './tool-runtime.ts';
import { capabilityInstruction, MAX_EXPERT_CALLS_PER_ROUND, MAX_EXPERT_ROUNDS } from './runtime-capabilities.ts';
import { createToolLoopGuard } from './tool-loop-guard.ts';
import { isEmptyOrProgressOnlyAnswer } from './agent-continuation-recovery.ts';
import type { AgentDefinition, AgentRegistry } from './agent-runtime.ts';
import type { AgentRunLedger } from './agent-run-ledger.ts';

type DelegatedRunResult={ok:boolean;content?:string;error?:string;models?:readonly string[]};
type NestedExecution=(input:{agent:AgentDefinition;task:string;repair?:string})=>Promise<DelegatedRunResult>;
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
  readonly ownerId?: string;
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  /** Extra tool wiring (web, research, sandbox...) for expert agents. */
  readonly toolContext?: Partial<ToolRuntimeContext>;
  /** Tool rounds before the final answer; 1 keeps the original single-round contract. */
  readonly maxRounds?: number;
  readonly wrapNestedDelegation?: (execute:NestedExecution)=> (input:{agent:AgentDefinition;task:string})=>Promise<DelegatedRunResult>;
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
type CompletionFn = (payload: unknown, signal?: AbortSignal, expertId?: string) => Promise<unknown>;

function normalizeToolCalls(calls: unknown): DelegatedToolCall[] {
  if (!Array.isArray(calls)) return [];
  return calls
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
  ownerId,
  sessionId,
  signal,
  toolContext,
  maxRounds = 1,
  wrapNestedDelegation
}: DelegatedAgentRunInput = {}):Promise<DelegatedRunResult> {
  if (!agent?.id || typeof task !== 'string' || !task.trim() || typeof traceId !== 'string' || !traceId.trim() || typeof parentTaskId !== 'string' || !parentTaskId.trim()) {
    return { ok: false, error: 'INVALID_DELEGATED_RUN' };
  }
  const safeTraceId = traceId.trim();
  const safeParentTaskId = parentTaskId.trim();
  const safeModel = typeof model === 'string' && model.trim() ? model.trim() : '';
  if (!Number.isInteger(depth) || depth < 0) return { ok: false, error: 'INVALID_DELEGATED_DEPTH' };
  if (!registry || typeof runLedger?.recordToolStart !== 'function' || typeof complete !== 'function') {
    return { ok: false, error: 'INVALID_DELEGATED_RUN' };
  }

  const startedAt = Date.now();
  const rounds = Number.isInteger(maxRounds) && maxRounds > 0 ? Math.min(maxRounds, MAX_EXPERT_ROUNDS) : 1;
  let roundsStarted = 0;
  let completedCalls = 0;
  const guard = createToolLoopGuard();
  const nestedDelegator = createAgentDelegator({
    registry,
    traceId: safeTraceId,
    parentAgent: agent,
    parentTaskId: safeParentTaskId,
    runLedger,
    parentSignal:signal,
    executeAgent: ({
      agent: nestedAgent,
      task: nestedTask,
      traceId: nestedTraceId,
      depth: nestedDepth,
      parentTaskId: nestedParentTaskId,
      signal: nestedSignal
    }) => {
      const execute:NestedExecution=({agent,task,repair})=>runDelegatedAgent({
      agent,
      task:repair?task+'\n\n'+repair:task,
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
      githubReadFile: typeof githubReadFile === 'function' ? githubReadFile as (args: unknown) => Promise<unknown> : undefined,
      skillsRuntime: skillsRuntime as { readonly resolveForAgent: (args: unknown) => unknown } | undefined,
      ownerId,
      sessionId,
      signal: nestedSignal ?? signal,
      toolContext,
      maxRounds,
      wrapNestedDelegation
    });
    return (wrapNestedDelegation?wrapNestedDelegation(execute):execute)({agent:nestedAgent,task:nestedTask});
    }
  });
  const delegateAgent = (args: unknown, toolSignal?:AbortSignal) => nestedDelegator.delegate(args, { depth,signal:toolSignal });
  // Experts get their own tools wired in (web, research, sandbox...) through toolContext; the
  // agent's tool policy still decides which of them it may call.
  const baseContext = {
    traceId: safeTraceId,
    agent,
    registry,
    nvidiaConfigured: Boolean(nvidiaConfigured),
    githubReadConfigured: Boolean(githubReadConfigured),
    githubReadFile: typeof githubReadFile === 'function' ? githubReadFile as (args: unknown) => Promise<unknown> : undefined,
    delegateAgent,
    approvalGranted: false,
    skillsRuntime: skillsRuntime as { readonly resolveForAgent: (args: unknown) => unknown } | undefined,
    ownerId,
    sessionId,
    signal,
    ...(toolContext || {}),
    runtimeBudget: () => ({ maxToolRounds: rounds, roundsStarted, toolCallsCompleted: completedCalls, timeoutMs: null, elapsedMs: Date.now() - startedAt, expertMaxRounds: rounds, maxCallsPerRound: MAX_EXPERT_CALLS_PER_ROUND })
  };
  const tools = getAllowedNvidiaTools(agent, baseContext);
  const context = { ...baseContext, advertisedToolNames: tools.map(tool => tool.function.name) };
  // Token usage of expert runs feeds the delegation audit and the expert's daily quota.
  const actualModels=new Set<string>();
  const completeRecorded: CompletionFn = async (payload, completionSignal) => {
    const response = await complete(payload, completionSignal, agent.id);
    const origin=completionOrigin(response);if(origin)actualModels.add(origin);
    toolContext?.telemetry?.recordCompletionUsage(safeTraceId, `expert:${agent.id}`, safeModel, response);
    return response;
  };
  const messages: unknown[] = [buildAgentSystemMessage(agent, safeTraceId, { tools: tools.length > 0, addendum: capabilityInstruction(getRuntimeCapabilities(agent, context)) }), { role: 'user' as const, content: task }];
  let anyToolFailed = false;

  for (let round = 0; round < rounds; round += 1) {
    if (signal?.aborted) return { ok: false, error: 'DELEGATION_CANCELLED' };
    roundsStarted = round + 1;
    const payload: Record<string, unknown> = {
      model: safeModel,
      messages,
      stream: false,
      max_tokens: maxTokens
    };
    if (tools.length) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }
    const completion = await normalizeCompletion(completeRecorded, payload, signal);
    if (!completion) return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };
    if (!completion.toolCalls.length) {
      if (!isEmptyOrProgressOnlyAnswer(completion.content)) return { ok: true, content: completion.content, ...(actualModels.size?{models:[...actualModels]}:{}) };
      break;
    }
    const calls = normalizeToolCalls(completion.toolCalls);
    if (!calls.length) return { ok: false, error: 'INVALID_TOOL_CALL' };
    const toolMessages: DelegatedToolMessage[] = [];
    for (const [callIndex, call] of calls.entries()) {
      const rejection = signal?.aborted ? 'DELEGATION_CANCELLED' : callIndex >= MAX_EXPERT_CALLS_PER_ROUND ? 'TOOL_BATCH_LIMIT' : !context.advertisedToolNames.includes(call.function.name) ? 'TOOL_NOT_ADVERTISED' : !guard.shouldRun(call.function.name, call.function.arguments) ? 'REPEATED_TOOL_CALL' : null;
      if (rejection) {
        anyToolFailed = true;
        toolMessages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify({ ok: false, error: rejection }) });
        continue;
      }
      const toolTask = runLedger.recordToolStart(call.function.name, {
        parentTaskId: safeParentTaskId,
        toolAgentId: agent.id
      });
      const result = await executeNvidiaToolCall(agent, call, context);
      completedCalls += 1;
      runLedger.recordToolFinish(toolTask.taskId, result);
      if (!result.ok) anyToolFailed = true;
      toolMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result)
      });
    }
    messages.push({ role: 'assistant', content: completion.content || null, tool_calls: calls }, ...toolMessages);
  }

  if (signal?.aborted) return { ok: false, error: 'DELEGATION_CANCELLED' };
  messages[0] = buildAgentSystemMessage(agent, safeTraceId, { tools: false, addendum: capabilityInstruction(getRuntimeCapabilities(agent, context)) + '\nAraç bütçesi sona erdi. Yeni araç çağırma; doğrulanmış sonuçları ve tamamlanmayan işi belirt. Başarı uydurma.' });
  const second = await normalizeCompletion(completeRecorded, {
    model,
    messages,
    stream: false,
    max_tokens: maxTokens,
    tools,
    tool_choice: 'none'
  }, signal);
  if (!second) return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };
  // A single-round run keeps the strict contract: any failed tool fails the delegation. Multi-round
  // experts already saw the failure and could work around it, so their answer stands.
  if (anyToolFailed && (rounds === 1 || !second.content.trim())) return { ok: false, error: 'DELEGATED_TOOL_FAILED' };
  if (second.toolCalls.length || isEmptyOrProgressOnlyAnswer(second.content)) return { ok: false, error: 'INCOMPLETE_DELEGATED_ANSWER' };

  return {
    ok: true,
    content: second.content,
    ...(actualModels.size?{models:[...actualModels]}:{})
  };
}
