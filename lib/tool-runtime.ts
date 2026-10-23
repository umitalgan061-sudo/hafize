import { authorizeAgentTool, type AgentDefinition } from './agent-runtime.ts';
import { realpath, stat, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANVA_READ_TOOL_DEFINITION } from './canva-read-tool-boundary.ts';
import { GMAIL_READ_TOOL_DEFINITION } from './gmail-read-tool-boundary.ts';
import { normalizeToolCall, parseToolArguments, sanitizeToolError } from './tool-call-boundary.ts';
import { projectSafeToolExecutionResult } from './tool-execution-result-policy.ts';
import { WEATHER_TOOL_DEFINITION } from './weather-tool.ts';
import { WEB_TOOL_DEFINITIONS } from './web-tools.ts';
import { MEMORY_TOOL_DEFINITIONS } from './memory-tools.ts';

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
  readonly weatherLookup?: (args: unknown, signal?: AbortSignal) => Promise<unknown>;
  readonly webTools?: Readonly<Partial<Record<'search' | 'readPage' | 'wikipedia' | 'news' | 'rates', (args: unknown, signal?: AbortSignal) => Promise<unknown>>>>;
  readonly memory?: { readonly save: (args: unknown) => Promise<unknown>; readonly forget: (args: unknown) => Promise<unknown> };
  readonly signal?: AbortSignal;
  /** Absolute workspace root used by the read-only fs.read tool. */
  readonly workspaceRoot?: string;
  readonly ownerId?: string;
  readonly sessionId?: string;
}

export type ToolDefinition = Readonly<{
  type: 'function';
  function: Readonly<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}>;

type ToolKind = 'diagnostic' | 'delegation' | 'connector' | 'repository' | 'skill' | 'web' | 'memory';
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
  readonly consentRequest?: Readonly<Record<string, unknown>>;
}
export type ToolExecutionResult<T = unknown> = ToolExecutionSuccess<T> | ToolExecutionFailure;

const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_TIMEOUT_MS = 2_000;
const MAX_TIMEOUT_MS = 120_000;
const FS_READ_ENCODINGS = new Set<BufferEncoding>(['utf-8', 'utf8', 'ascii', 'latin1', 'base64', 'hex']);

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

// Secrets never enter the agent context (registry policy secretsNeverEnterAgentContext): .env and
// other dotfiles, key/credential-named files, runtime data (audit log, OAuth stores) and logs.
const SENSITIVE_SEGMENT = /^(?:\.|node_modules$|data$)/i;
const SENSITIVE_NAME = /(?:secret|token|credential|password|passwd|private|id_rsa|\.pem$|\.key$|\.p12$|\.pfx$|\.crt$|\.log$|\.jsonl$)/i;
export function isSensitiveWorkspacePath(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]+/).filter(Boolean);
  if (!segments.length) return true;
  return segments.some((segment) => SENSITIVE_SEGMENT.test(segment)) || SENSITIVE_NAME.test(segments[segments.length - 1]);
}

const CATALOG = new Map<string, ToolEntry>([
  ['fs_read', {
    permission: 'fs.read',
    kind: 'repository',
    timeoutMs: timeout(10_000, 10_000),
    activity: { running: 'Workspace dosyası okunuyor', success: 'Workspace dosyası okundu', failure: 'Workspace dosyası okunamadı' },
    definition: definition('fs_read', 'Workspace içindeki bir metin dosyasını güvenli ve salt-okunur okur.', {
      path: { type: 'string' },
      encoding: { type: 'string' },
      maxBytes: { type: 'integer', minimum: 1, maximum: 1048576 }
    }),
    execute: async (args, context) => {
      const path = args.path;
      const encoding = args.encoding === undefined ? 'utf-8' : args.encoding;
      const maxBytes = args.maxBytes === undefined ? 1_048_576 : args.maxBytes;
      if (typeof path !== 'string' || !path.trim()) return { error: 'FS_READ_ERROR', code: 'INVALID_PATH', message: 'path argümanı zorunlu string olmalı' };
      if (typeof maxBytes !== 'number' || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_048_576) return { error: 'FS_READ_ERROR', code: 'INVALID_LIMIT', message: 'maxBytes 1 ile 1048576 arasında tam sayı olmalı' };
      // Text encodings only: base64/hex output would slip past the credential filter on tool results.
      if (typeof encoding !== 'string' || (encoding !== 'utf-8' && encoding !== 'utf8')) return { error: 'FS_READ_ERROR', code: 'INVALID_ENCODING', message: 'Yalnızca utf-8 desteklenir' };
      const workspaceRoot = context.workspaceRoot || fileURLToPath(new URL('../', import.meta.url));
      const root = await realpath(resolve(workspaceRoot));
      const requested = resolve(root, path.trim());
      if (!requested.startsWith(root + sep) && requested !== root) return { error: 'FS_READ_ERROR', code: 'TRAVERSAL', message: 'Workspace dışına çıkış engellendi' };
      try {
        const resolved = await realpath(requested);
        if (!resolved.startsWith(root + sep) && resolved !== root) return { error: 'FS_READ_ERROR', code: 'TRAVERSAL', message: 'Workspace dışına çıkış engellendi' };
        if (isSensitiveWorkspacePath(relative(root, resolved))) return { error: 'FS_READ_ERROR', code: 'SENSITIVE_PATH', message: 'Bu dosya gizli bilgi içerebileceği için okunamaz' };
        const stats = await stat(resolved);
        if (!stats.isFile()) return { error: 'FS_READ_ERROR', code: 'NOT_A_FILE', message: 'Belirtilen yol bir dosya değil' };
        if (stats.size > maxBytes) return { error: 'FS_READ_ERROR', code: 'TOO_LARGE', message: `Dosya ${stats.size} bayt, limit ${maxBytes} bayt` };
        const content = await readFile(resolved, encoding);
        return { content, size: stats.size, encoding, path: path.trim() };
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        const code = error.code === 'ENOENT' ? 'NOT_FOUND' : error.code === 'EACCES' ? 'PERMISSION_DENIED' : 'FS_READ_ERROR';
        return { error: 'FS_READ_ERROR', code, message: error.message || 'Okuma başarısız' };
      }
    }
  }],
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
  ['weather_forecast', {
    permission: 'web.weather.read',
    kind: 'web',
    timeoutMs: timeout(20_000, 20_000),
    activity: { running: 'Hava durumu alınıyor', success: 'Hava durumu alındı', failure: 'Hava durumu alınamadı' },
    definition: WEATHER_TOOL_DEFINITION as ToolDefinition,
    available: (context) => typeof context.weatherLookup === 'function',
    execute: async (args, context) => context.weatherLookup!(args, context.signal)
  }],
  ...([
    ['web_search', 'search', 'web.search', 20_000, { running: 'İnternette aranıyor', success: 'İnternette arandı', failure: 'İnternet araması yapılamadı' }],
    ['web_page_read', 'readPage', 'web.read', 25_000, { running: 'Web sayfası okunuyor', success: 'Web sayfası okundu', failure: 'Web sayfası okunamadı' }],
    ['wikipedia_lookup', 'wikipedia', 'web.wikipedia.read', 15_000, { running: 'Vikipedi\'ye bakılıyor', success: 'Vikipedi\'ye bakıldı', failure: 'Vikipedi\'ye ulaşılamadı' }],
    ['news_search', 'news', 'web.news.read', 15_000, { running: 'Haberler alınıyor', success: 'Haberler alındı', failure: 'Haberler alınamadı' }],
    ['exchange_rates', 'rates', 'web.rates.read', 15_000, { running: 'Döviz kurları alınıyor', success: 'Döviz kurları alındı', failure: 'Döviz kurları alınamadı' }]
  ] as const).map(([name, method, permission, timeoutMs, activity]): [string, ToolEntry] => [name, {
    permission,
    kind: 'web',
    timeoutMs: timeout(timeoutMs, timeoutMs),
    activity,
    definition: WEB_TOOL_DEFINITIONS[name] as ToolDefinition,
    available: (context) => typeof context.webTools?.[method] === 'function',
    execute: async (args, context) => context.webTools![method]!(args, context.signal)
  }]),
  ['memory_save', {
    permission: 'memory.write',
    kind: 'memory',
    timeoutMs: timeout(5_000, 5_000),
    activity: { running: 'Hafızaya kaydediliyor', success: 'Hafızaya kaydedildi', failure: 'Hafızaya kaydedilemedi' },
    definition: MEMORY_TOOL_DEFINITIONS.memory_save as ToolDefinition,
    available: (context) => typeof context.memory?.save === 'function',
    execute: async (args, context) => context.memory!.save(args)
  }],
  ['memory_forget', {
    permission: 'memory.write',
    kind: 'memory',
    timeoutMs: timeout(5_000, 5_000),
    activity: { running: 'Hafızadan siliniyor', success: 'Hafızadan silindi', failure: 'Hafızadan silinemedi' },
    definition: MEMORY_TOOL_DEFINITIONS.memory_forget as ToolDefinition,
    available: (context) => typeof context.memory?.forget === 'function',
    execute: async (args, context) => context.memory!.forget(args)
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
        traceId: context.traceId,
        ownerId: context.ownerId,
        sessionId: context.sessionId,
        approvalGranted: context.approvalGranted === true
      }) as Record<string, unknown> | null;
      if (!invocation) throw new Error('UNKNOWN_SKILL');
      return {
        skill: invocation.name,
        execution: invocation.execution,
        model: invocation.model,
        tools: invocation.tools,
        arguments: invocation.arguments,
        parameters: invocation.parameters,
        returns: invocation.returns,
        requiredScopes: invocation.requiredScopes,
        sideEffects: invocation.sideEffects,
        riskLevel: invocation.riskLevel,
        rollbackHint: invocation.rollbackHint,
        consentId: invocation.consentId,
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
  // The skills runtime hands back a frozen array of granted permissions, so the
  // scope is any iterable of names rather than a Set specifically.
  options: { readonly allowedPermissions?: Iterable<string> } = {}
): readonly ToolDefinition[] {
  const scope = options.allowedPermissions ? new Set(options.allowedPermissions) : null;
  const output: ToolDefinition[] = [];
  for (const entry of catalogEntries()) {
    if (entry.available && !entry.available(context)) continue;
    if (scope && !scope.has(entry.permission)) continue;
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
      ...(error && typeof error === 'object' && 'consent' in error && error.consent && typeof error.consent === 'object'
        ? { consentRequest: error.consent as Readonly<Record<string, unknown>> }
        : {}),
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
