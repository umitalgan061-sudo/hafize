import { authorizeAgentTool, type AgentDefinition } from './agent-runtime.ts';
import { CANVA_READ_TOOL_DEFINITION } from './canva-read-tool-boundary.ts';
import { GMAIL_READ_TOOL_DEFINITION } from './gmail-read-tool-boundary.ts';
import { normalizeToolCall, parseToolArguments, sanitizeToolError } from './tool-call-boundary.ts';
import { projectSafeToolExecutionResult } from './tool-execution-result-policy.ts';

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
      agentId: { type: 'string' },
      task: { type: 'string' }
    }),
    available: (context) => typeof context.delegateAgent === 'function',
    execute: async (args, context) => {
      const result = await context.delegateAgent!(args) as { ok?: boolean; error?: unknown; value?: unknown };
      if (result?.ok !== true) throw new Error(typeof result?.error === 'string' ? result.error : 'AGENT_DELEGATION_FAILED');
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
    available: (context) => context.canvaReadAuthenticated === true && typeof context.canvaReadTool?.execute === 'function',
    execute: async (args, context) => context.canvaReadTool!.execute(args)
  }],
  ['gmail_read', {
    permission: 'connector.gmail.read',
    kind: 'connector',
    timeoutMs: timeout(60_000),
    activity: { running: 'Gmail verisi okunuyor', success: 'Gmail verisi okundu', failure: 'Gmail verisi okunamadı' },
    definition: GMAIL_READ_TOOL_DEFINITION as ToolDefinition,
    available: (context) => context.gmailReadAuthenticated === true && typeof context.gmailReadTool?.execute === 'function',
    execute: async (args, context) => context.gmailReadTool!.execute(args)
  }],
  ['skill_invoke', {
    permission: 'skill.invoke',
    kind: 'skill',
    timeoutMs: timeout(30_000, 30_000),
    activity: { running: 'Hafize skill hazırlanıyor', success: 'Hafize skill hazırlandı', failure: 'Hafize skill hazırlanamadı' },
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
  // A skill invocation hands back `tools` as a frozen array of permissions, so
  // accept any iterable rather than only a Set.
  options: { readonly allowedPermissions?: Iterable<string> } = {}
): readonly ToolDefinition[] {
  const allowedPermissions = options.allowedPermissions == null
    ? null
    : options.allowedPermissions instanceof Set
      ? options.allowedPermissions as ReadonlySet<string>
      : new Set(options.allowedPermissions);
  const output: ToolDefinition[] = [];
  for (const entry of catalogEntries()) {
    if (entry.available && !entry.available(context)) continue;
    if (allowedPermissions && !allowedPermissions.has(entry.permission)) continue;
    if (authorize(agent, entry.permission, Boolean(context.approvalGranted)).allowed) output.push(entry.definition);
  }
  return Object.freeze(output);
}
export function getPublicToolRunningActivity(name: unknown): Readonly<{ label: string; state: 'running'; tool: string; timeoutMs: number } | null> {
  const entry = typeof name === 'string' ? CATALOG.get(name) : undefined;
  return entry ? Object.freeze({ label: entry.activity.running, state: 'running' as const, tool: name as string, timeoutMs: entry.timeoutMs }) : null;
}
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
    ...(typeof value.error === 'string' ? { error: value.error.slice(0, 120) } : {})
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
