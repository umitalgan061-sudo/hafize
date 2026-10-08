import { authorizeAgentTool, type AgentDefinition } from './agent-runtime.ts';
import { CANVA_READ_TOOL_DEFINITION } from './canva-read-tool-boundary.ts';
import { GMAIL_READ_TOOL_DEFINITION } from './gmail-read-tool-boundary.ts';
import { ToolBoundaryError, normalizeToolCall, parseToolArguments, sanitizeToolError } from './tool-call-boundary.ts';
import { projectSafeToolExecutionResult } from './tool-execution-result-policy.ts';
import { TASK_HANDOFF_LIMITS } from './task-handoff.ts';

export interface ToolAgent {
  readonly id: string;
  readonly name: string;
}
export interface ToolRuntimeContext {
  readonly traceId: string;
  readonly agent: ToolAgent;
  readonly registry?: { readonly agents?: readonly ToolAgent[] };
  readonly nvidiaConfigured?: boolean;
  readonly githubReadConfigured?: boolean;
  readonly githubReadFile?: (args: unknown) => Promise<unknown>;
  readonly delegateAgent?: (args: unknown) => Promise<unknown>;
  readonly approvalGranted?: boolean;
  readonly canvaReadAuthenticated?: boolean;
  readonly canvaReadTool?: { readonly execute: (args: unknown) => Promise<unknown> };
  readonly gmailReadAuthenticated?: boolean;
  readonly gmailReadTool?: { readonly execute: (args: unknown) => Promise<unknown> };
  readonly skillsRuntime?: { readonly resolveForAgent: (args: unknown) => unknown };
  readonly signal?: AbortSignal;
}

export type ToolDefinition = Readonly<{
  type: 'function';
  function: Readonly<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}>;

type ToolKind = 'diagnostic' | 'delegation' | 'connector' | 'repository' | 'skill';
type ToolActivity = Readonly<{ running: string; success: string; failure: string }>;

export interface ToolEntry {
  readonly permission: string;
  readonly kind: ToolKind;
  readonly timeoutMs: number;
  readonly definition: ToolDefinition;
  readonly available?: (context: ToolRuntimeContext) => boolean;
  readonly execute: (args: Record<string, unknown>, context: ToolRuntimeContext) => Promise<unknown>;
  readonly activity: ToolActivity;
}

export interface ToolExecutionSuccess<T = unknown> {
  readonly ok: true;
  readonly tool: string;
  readonly value: T;
  readonly durationMs: number;
}
export interface ToolExecutionFailure {
  readonly ok: false;
  readonly tool: string;
  readonly error: string;
  readonly reason?: string;
  readonly status?: number;
  readonly durationMs: number;
}
export type ToolExecutionResult<T = unknown> = ToolExecutionSuccess<T> | ToolExecutionFailure;

const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_TIMEOUT_MS = 2_000;
const MAX_TIMEOUT_MS = 120_000;

const handoffList = (description: string) =>
  Object.freeze({
    type: 'array',
    description,
    maxItems: TASK_HANDOFF_LIMITS.maxItems,
    items: Object.freeze({ type: 'string', maxLength: TASK_HANDOFF_LIMITS.maxListItem })
  });

const definition = (name: string, description: string, properties: Record<string, unknown>): ToolDefinition =>
  Object.freeze({
    type: 'function',
    function: Object.freeze({
      name,
      description,
      parameters: Object.freeze({ type: 'object', properties: Object.freeze(properties), additionalProperties: false })
    })
  });

function timeout(value: unknown, fallback = DEFAULT_TIMEOUT_MS): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(Math.max(Number(value), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}
function isAgentDefinition(agent: ToolAgent | AgentDefinition): agent is AgentDefinition {
  return typeof agent === 'object' && agent !== null && 'toolPolicy' in agent;
}
function authorize(agent: ToolAgent | AgentDefinition, permission: string, approvalGranted: boolean) {
  return authorizeAgentTool(agent as AgentDefinition, permission, { approvalGranted });
}
function timeoutSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timerSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timerSignal]) : timerSignal;
}
function abortedReason(signal: AbortSignal | undefined): 'TOOL_ABORTED' | 'TOOL_TIMEOUT' | null {
  if (!signal?.aborted) return null;
  const reason = signal.reason;
  if (reason && typeof reason === 'object' && 'name' in reason && reason.name === 'TimeoutError') return 'TOOL_TIMEOUT';
  if (reason === 'TOOL_TIMEOUT') return 'TOOL_TIMEOUT';
  return 'TOOL_ABORTED';
}

const CATALOG = new Map<string, ToolEntry>([
  ['runtime_status', {
    permission: 'runtime.status',
    kind: 'diagnostic',
    timeoutMs: timeout(10_000, 10_000),
    activity: { running: 'Runtime durumu kontrol ediliyor', success: 'Runtime durumu kontrol edildi', failure: 'Runtime durumu kontrol edilemedi' },
    definition: definition('runtime_status', 'Hafize runtime durumunu salt-okunur olarak döndürür.', {}),
    execute: async (_args, context) => ({
      status: 'ok',
      traceId: context.traceId,
      agentId: context.agent.id,
      agentName: context.agent.name,
      nvidiaConfigured: Boolean(context.nvidiaConfigured),
      githubReadConfigured: Boolean(context.githubReadConfigured),
      availableAgents: (context.registry?.agents || []).map((agent) => ({ id: agent.id, name: agent.name }))
    })
  }],
  ['agent_delegate', {
    permission: 'agent.delegate',
    kind: 'delegation',
    timeoutMs: timeout(90_000, 90_000),
    activity: { running: 'Uzman ajan çalıştırılıyor', success: 'Uzman ajan çalıştırıldı', failure: 'Uzman ajan çalıştırılamadı' },
    definition: definition('agent_delegate', 'Dar kapsamlı bir görevi uzman Hafize ajanına delege eder.', {
      agentId: { type: 'string', maxLength: TASK_HANDOFF_LIMITS.maxAgentId },
      task: { type: 'string', maxLength: TASK_HANDOFF_LIMITS.maxTask },
      // The handoff normalizer bounds these lists, so the schema the model sees
      // declares the same bounds instead of hiding the fields entirely.
      successCriteria: handoffList('Devredilen görevin kabul ölçütleri.'),
      constraints: handoffList('Uzman ajanın uyması gereken kısıtlar.'),
      evidenceRequired: handoffList('Sonuçla birlikte beklenen kanıtlar.')
    }),
    available: (context) => typeof context.delegateAgent === 'function',
    execute: async (args, context) => {
      const result = await context.delegateAgent!(args) as { ok?: boolean; error?: unknown; value?: unknown };
      // The delegator's own error codes (depth, fan-out, authorization, target)
      // are stable and safe to report, so they are carried as the boundary code
      // instead of collapsing into a generic TOOL_EXECUTION_FAILED.
      if (result?.ok !== true) {
        throw new ToolBoundaryError(typeof result?.error === 'string' && result.error.trim() ? result.error.trim() : 'AGENT_DELEGATION_FAILED');
      }
      return result.value;
    }
  }],
  ['github_read_file', {
    permission: 'repo.read',
    kind: 'repository',
    timeoutMs: timeout(60_000),
    activity: { running: 'GitHub dosyası okunuyor', success: 'GitHub dosyası okundu', failure: 'GitHub dosyası okunamadı' },
    definition: definition('github_read_file', 'İzin verilen GitHub reposundaki bir metin dosyasını salt-okunur getirir.', {
      repository: { type: 'string' },
      path: { type: 'string' },
      ref: { type: 'string' }
    }),
    available: (context) => Boolean(context.githubReadConfigured && context.githubReadFile),
    execute: async (args, context) => context.githubReadFile!(args)
  }],
  ['canva_read', {
    permission: 'connector.canva.read',
    kind: 'connector',
    timeoutMs: timeout(60_000),
    activity: { running: 'Canva verisi okunuyor', success: 'Canva verisi okundu', failure: 'Canva verisi okunamadı' },
    definition: CANVA_READ_TOOL_DEFINITION as ToolDefinition,
    available: (context) => context.canvaReadAuthenticated === true && Boolean(context.canvaReadTool),
    execute: async (args, context) => context.canvaReadTool!.execute(args)
  }],
  ['gmail_read', {
    permission: 'connector.gmail.read',
    kind: 'connector',
    timeoutMs: timeout(60_000),
    activity: { running: 'Gmail verisi okunuyor', success: 'Gmail verisi okundu', failure: 'Gmail verisi okunamadı' },
    definition: GMAIL_READ_TOOL_DEFINITION as ToolDefinition,
    available: (context) => context.gmailReadAuthenticated === true && Boolean(context.gmailReadTool),
    execute: async (args, context) => context.gmailReadTool!.execute(args)
  }],
  ['skill_invoke', {
    permission: 'skill.invoke',
    kind: 'skill',
    timeoutMs: timeout(30_000, 30_000),
    activity: { running: 'Hafize skill’i hazırlanıyor', success: 'Hafize skill’i hazırlandı', failure: 'Hafize skill’i hazırlanamadı' },
    definition: definition('skill_invoke', 'Registry içindeki güvenli Hafize skill yapısını çözümler.', {
      skillId: { type: 'string' },
      args: { type: 'object' }
    }),
    available: (context) => typeof context.skillsRuntime?.resolveForAgent === 'function',
    execute: async (args, context) => {
      const invocation = context.skillsRuntime!.resolveForAgent({
        agent: context.agent,
        skillId: args.skillId,
        args: args.args,
        approvalGranted: context.approvalGranted === true
      }) as Record<string, unknown> | null;
      if (!invocation) throw new Error('UNKNOWN_SKILL');
      return {
        skill: invocation.name,
        execution: invocation.execution,
        model: invocation.model,
        tools: invocation.tools,
        arguments: invocation.arguments,
        prompt: invocation.prompt
      };
    }
  }]
]);

function catalogEntries(): readonly ToolEntry[] {
  return Object.freeze([...CATALOG.values()]);
}
export function getAllowedNvidiaTools(
  agent: ToolAgent,
  context: ToolRuntimeContext,
  options: { readonly allowedPermissions?: ReadonlySet<string> } = {}
): readonly ToolDefinition[] {
  const output: ToolDefinition[] = [];
  for (const entry of catalogEntries()) {
    if (entry.available && !entry.available(context)) continue;
    if (options.allowedPermissions && !options.allowedPermissions.has(entry.permission)) continue;
    if (authorize(agent, entry.permission, Boolean(context.approvalGranted)).allowed) output.push(entry.definition);
  }
  return Object.freeze(output);
}
export function getPublicToolRunningActivity(name: unknown): Readonly<{ label: string; state: 'running'; tool: string; timeoutMs: number } | null> {
  const entry = typeof name === 'string' ? CATALOG.get(name) : undefined;
  return entry ? Object.freeze({ label: entry.activity.running, state: 'running' as const, tool: name as string, timeoutMs: entry.timeoutMs }) : null;
}
/**
 * Tool error codes the browser is allowed to see.
 *
 * `getPublicToolActivity()` feeds the chat activity line, so it must not echo
 * an arbitrary upstream error string back to the page. Only the runtime's own
 * stable codes are surfaced; anything else is reported as a generic failure.
 */
export const PUBLIC_TOOL_ERROR_CODES = Object.freeze(new Set([
  'UNKNOWN_TOOL', 'TOOL_NOT_AUTHORIZED', 'TOOL_UNAVAILABLE', 'TOOL_ABORTED', 'TOOL_TIMEOUT', 'TOOL_EXECUTION_FAILED',
  'INVALID_TOOL_CALL', 'INVALID_TOOL_CALL_ID', 'INVALID_TOOL_NAME', 'INVALID_TOOL_ARGUMENTS', 'TOOL_ARGUMENTS_TOO_LARGE',
  'AGENT_DELEGATION_FAILED', 'DELEGATED_AGENT_FAILED', 'DELEGATED_RESULT_INVALID', 'DELEGATION_CANCELLED',
  'DELEGATION_DEPTH_EXCEEDED', 'DELEGATION_FANOUT_EXCEEDED', 'DELEGATION_NOT_AUTHORIZED',
  'DELEGATION_TARGET_NOT_FOUND', 'DELEGATION_TARGET_NOT_SPECIALIST', 'INVALID_DELEGATION_ARGUMENTS',
  'INVALID_DELEGATION_DEPTH', 'SELF_DELEGATION_NOT_ALLOWED',
  'TOOL_RESULT_ACCESSOR_BLOCKED', 'TOOL_RESULT_COMPLEXITY_BLOCKED', 'TOOL_RESULT_CREDENTIAL_BLOCKED',
  'TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED', 'TOOL_RESULT_INSPECTION_FAILED', 'TOOL_RESULT_SHAPE_BLOCKED',
  'TOOL_RESULT_UNSAFE'
]));

export function getPublicToolActivity(name: unknown, result: unknown): Readonly<{ label: string; state: 'success' | 'failure'; tool: string; durationMs?: number; error?: string } | null> {
  const entry = typeof name === 'string' ? CATALOG.get(name) : undefined;
  if (!entry) return null;
  const ok = Boolean(result && typeof result === 'object' && (result as { ok?: boolean }).ok === true);
  const value = result && typeof result === 'object' ? result as { durationMs?: unknown; error?: unknown } : {};
  return Object.freeze({
    label: ok ? entry.activity.success : entry.activity.failure,
    state: ok ? 'success' as const : 'failure' as const,
    tool: name as string,
    ...(Number.isFinite(value.durationMs) ? { durationMs: Number(value.durationMs) } : {}),
    ...(typeof value.error === 'string' && PUBLIC_TOOL_ERROR_CODES.has(value.error) ? { error: value.error } : {})
  });
}
export async function executeNvidiaToolCall(
  agent: ToolAgent,
  toolCall: unknown,
  context: ToolRuntimeContext
): Promise<ToolExecutionResult> {
  const startedAt = Date.now();
  let normalized;
  try {
    normalized = normalizeToolCall(toolCall);
  } catch (error) {
    return { ok: false, tool: 'unknown', error: sanitizeToolError(error).code, durationMs: Date.now() - startedAt };
  }
  const entry = CATALOG.get(normalized.function.name);
  if (!entry) {
    return { ok: false, tool: normalized.function.name, error: 'UNKNOWN_TOOL', durationMs: Date.now() - startedAt };
  }
  const authorization = authorize(agent, entry.permission, Boolean(context.approvalGranted));
  if (!authorization.allowed) {
    return {
      ok: false,
      tool: entry.definition.function.name,
      error: 'TOOL_NOT_AUTHORIZED',
      reason: authorization.reason,
      durationMs: Date.now() - startedAt
    };
  }
  if (entry.available && !entry.available(context)) {
    return { ok: false, tool: entry.definition.function.name, error: 'TOOL_UNAVAILABLE', durationMs: Date.now() - startedAt };
  }
  let args: Record<string, unknown>;
  try {
    args = parseToolArguments(normalized.function.arguments);
  } catch (error) {
    return { ok: false, tool: entry.definition.function.name, error: sanitizeToolError(error).code, durationMs: Date.now() - startedAt };
  }

  const signal = timeoutSignal(context.signal, entry.timeoutMs);
  try {
    const value = await entry.execute(args, { ...context, signal });
    const safe = projectSafeToolExecutionResult({ ok: true as const, value });
    if (!safe.ok) {
      return { ok: false, tool: entry.definition.function.name, error: safe.error, durationMs: Date.now() - startedAt };
    }
    return { ok: true, tool: entry.definition.function.name, value: safe.value, durationMs: Date.now() - startedAt };
  } catch (error) {
    const abortError = abortedReason(signal);
    const safe = sanitizeToolError(error);
    return {
      ok: false,
      tool: entry.definition.function.name,
      error: abortError || safe.code,
      ...(safe.status !== null ? { status: safe.status } : {}),
      durationMs: Date.now() - startedAt
    };
  }
}
export function listToolPermissions(): readonly Readonly<{ name: string; permission: string; kind: ToolKind; timeoutMs: number }>[] {
  return Object.freeze([...CATALOG.entries()].map(([name, entry]) => Object.freeze({
    name,
    permission: entry.permission,
    kind: entry.kind,
    timeoutMs: entry.timeoutMs
  })));
}
export const TOOL_RUNTIME_LIMITS = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  minTimeoutMs: MIN_TIMEOUT_MS,
  maxTimeoutMs: MAX_TIMEOUT_MS,
  catalogSize: CATALOG.size
});
