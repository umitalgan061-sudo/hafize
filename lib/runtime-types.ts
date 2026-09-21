/**
 * Hafize runtime shared contracts.
 *
 * Runtime code must remain erasable-TypeScript: these declarations generate no
 * JavaScript and are safe for Node 24 native type stripping.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type MaybePromise<T> = T | Promise<T>;

export type RuntimeErrorShape = Error & {
  status?: number;
  code?: string;
  detail?: string;
  requestId?: string | null;
};

export type RequestHeaders = Record<string, string | string[] | undefined>;

export interface AuthenticatedPrincipal {
  authenticated: true;
  subject: string;
  [key: string]: unknown;
}

export interface AuthResult {
  ok: boolean;
  principal?: AuthenticatedPrincipal;
}

export interface PrincipalAuthenticator {
  authenticate(input: { headers?: RequestHeaders }): AuthResult;
}

export interface AgentDefinition {
  id: string;
  name?: string;
  kind?: string;
  description?: string;
  [key: string]: unknown;
}

export interface AgentRegistryLike {
  defaultAgent: string;
  agents?: AgentDefinition[];
  [key: string]: unknown;
}

export interface ToolCallFunction {
  name: string;
  arguments: unknown;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: ToolCallFunction;
}

export interface ToolActivity {
  label: string;
  state: 'running' | 'success' | 'failure';
}

export interface ToolDefinition {
  type: 'function' | string;
  function?: {
    name: string;
    description?: string;
    parameters?: JsonObject;
  };
  [key: string]: unknown;
}

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | string;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface CompletionPayload {
  model?: string;
  messages: CompletionMessage[];
  stream?: boolean;
  max_tokens?: number;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | string;
  [key: string]: unknown;
}

export interface NormalizedCompletion {
  content: string;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: unknown;
  }>;
}

export type CompleteFunction = (
  payload: CompletionPayload,
  signal?: AbortSignal
) => Promise<unknown>;

export interface RunLedgerLike {
  rootTaskId?: string;
  recordToolStart(name: string, metadata?: Record<string, unknown>): { taskId: string };
  recordToolFinish(taskId: string, result: unknown): void;
  finish?(result: unknown): void;
}

export interface DelegatedAgentContext {
  agent: AgentDefinition;
  task: string;
  traceId: string;
  parentTaskId: string;
  depth: number;
}

export interface SchedulePrincipalCommand {
  principal: AuthenticatedPrincipal;
  input?: unknown;
}

export interface ScheduleCommandsLike {
  create(input: SchedulePrincipalCommand): MaybePromise<unknown>;
  list(input: { principal: AuthenticatedPrincipal }): MaybePromise<unknown>;
  cancel(input: { principal: AuthenticatedPrincipal; scheduleId: string }): MaybePromise<unknown>;
}

export interface ScheduleHttpResponse {
  matched: boolean;
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export interface ScheduleHttpRequest {
  request?: unknown;
  method?: string;
  pathname?: string;
  headers?: RequestHeaders;
}

export interface ConnectorContext {
  canvaReadAuthenticated?: boolean;
  gmailReadAuthenticated?: boolean;
  canvaReadTool?: unknown;
  gmailReadTool?: unknown;
  [key: string]: unknown;
}

export interface ConnectorRuntimeStatus {
  configured: boolean;
  access: 'disabled' | 'authenticated-read-only' | string;
}

export interface ConnectorRuntime {
  configured: boolean;
  requestContext(input?: { headers?: RequestHeaders }): ConnectorContext;
  connectionStatus(input?: { headers?: RequestHeaders }): Promise<unknown>;
  status(): ConnectorRuntimeStatus;
}

export interface GithubReadInput {
  repository?: unknown;
  path?: unknown;
  ref?: unknown;
  [key: string]: unknown;
}

export interface GithubReadResult {
  repository: string;
  path: string;
  ref: string | null;
  sha: string | null;
  size: number;
  content: string;
  truncated: boolean;
}

export interface GithubReadOptions {
  token?: string;
  allowedRepositories?: string[] | string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxFileBytes?: number;
}

export interface ScheduleStoreRuntime {
  store: unknown;
  durable: boolean;
}

export interface ScheduleLeaseRuntime {
  configured: boolean;
  provider?: string;
  lease?: unknown;
  renewIntervalMs?: number;
  close(): Promise<void>;
}

export interface RedisClientRuntime {
  client?: {
    isOpen?: boolean;
    quit?: () => Promise<unknown>;
    disconnect?: () => void;
  };
  configured?: boolean;
}

export interface TypeGuardOptions {
  maxLength?: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isNonEmptyString(value: unknown, options: TypeGuardOptions = {}): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return options.maxLength === undefined || trimmed.length <= options.maxLength;
}

export function isFiniteInteger(value: unknown, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isStringArray(value: unknown, maxLength = Number.POSITIVE_INFINITY): value is string[] {
  return Array.isArray(value)
    && value.length <= maxLength
    && value.every((item) => typeof item === 'string');
}

export function asRequestHeaders(value: unknown): RequestHeaders {
  if (!isRecord(value)) return {};
  const output: RequestHeaders = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string' || Array.isArray(raw) && raw.every((item) => typeof item === 'string')) {
      output[key] = raw as string | string[];
    }
  }
  return output;
}

export function toRuntimeError(error: unknown, fallbackCode = 'RUNTIME_ERROR'): RuntimeErrorShape {
  if (error instanceof Error) return error as RuntimeErrorShape;
  const normalized = new Error(fallbackCode) as RuntimeErrorShape;
  if (isRecord(error) && typeof error.message === 'string') normalized.message = error.message;
  if (isRecord(error) && typeof error.code === 'string') normalized.code = error.code;
  return normalized;
}

export function ok<T>(value: T): { ok: true; value: T } {
  return Object.freeze({ ok: true, value });
}

export function fail<E>(error: E): { ok: false; error: E } {
  return Object.freeze({ ok: false, error });
}

export type Result<T, E> = ReturnType<typeof ok<T>> | ReturnType<typeof fail<E>>;

export function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export const RUNTIME_CONTRACT_VERSION = '2026-09-21';
