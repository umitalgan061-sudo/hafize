export const ERROR_CODES = Object.freeze([
  'AUTH_REQUIRED',
  'AUTH_NOT_CONFIGURED',
  'CSRF_REQUIRED',
  'RATE_LIMITED',
  'INVALID_CHAT_REQUEST',
  'INVALID_AGENT',
  'TOOL_NOT_AUTHORIZED',
  'TOOL_UNAVAILABLE',
  'INVALID_TOOL_ARGUMENTS',
  'BODY_TOO_LARGE',
  'NVIDIA_NOT_CONFIGURED',
  'NVIDIA_CHAT_ERROR',
  'INVALID_NVIDIA_RESPONSE',
  'SCHEDULE_COMMAND_FAILED',
  'SCHEDULE_EXECUTION_FAILED',
  'SCHEDULE_LEASE_BUSY',
  'SCHEDULE_CAPACITY_REACHED',
  'SCHEDULE_NOT_FOUND',
  'SCHEDULE_NOT_CANCELLABLE',
  'INVALID_SCHEDULE_COMMAND',
  'INVALID_SCHEDULE',
  'DELEGATED_AGENT_FAILED'
] as const);

export type ApiErrorCode = typeof ERROR_CODES[number] | 'INTERNAL_ERROR' | 'TOOL_EXECUTION_FAILED';
export type ApiErrorStatus = number;

const KNOWN = new Set<string>(ERROR_CODES);

function cleanCode(value: unknown): ApiErrorCode {
  const code = typeof value === 'string' ? value.trim() : '';
  return KNOWN.has(code) ? code as ApiErrorCode : 'INTERNAL_ERROR';
}

function cleanMessage(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500);
}

export interface NormalizeApiErrorInput {
  readonly code?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
  readonly requestId?: unknown;
}

export interface NormalizedApiError {
  readonly error: ApiErrorCode;
  readonly status: ApiErrorStatus;
  readonly message: string;
  readonly requestId?: string;
}

export function normalizeApiError(input: NormalizeApiErrorInput = {}): NormalizedApiError {
  const status = Number.isInteger(input.status) && Number(input.status) >= 400 && Number(input.status) <= 599 ? Number(input.status) : 500;
  const requestId = typeof input.requestId === 'string' && input.requestId.trim() ? input.requestId.trim().slice(0, 120) : undefined;
  const payload: NormalizedApiError = {
    error: cleanCode(input.code),
    status,
    message: cleanMessage(input.message)
  };
  return Object.freeze(requestId ? { ...payload, requestId } : payload);
}

export function isRetryableApiError(error: NormalizeApiErrorInput = {}): boolean {
  const normalized = normalizeApiError(error);
  return normalized.status === 408 || normalized.status === 425 || normalized.status === 429 || normalized.status >= 500;
}

export function mapToolFailureToApiError(result: unknown, requestId?: string): NormalizedApiError {
  const value = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  const code = typeof value.error === 'string' ? value.error : 'TOOL_EXECUTION_FAILED';
  const status = Number.isInteger(value.status) ? Number(value.status) : code === 'TOOL_NOT_AUTHORIZED' ? 403 : 502;
  return normalizeApiError({ code, status, requestId });
}

export const API_ERROR_CONTRACT = Object.freeze({ codes: ERROR_CODES, maxMessageLength: 500, maxRequestIdLength: 120 });
