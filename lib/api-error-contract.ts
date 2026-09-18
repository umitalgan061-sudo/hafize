import type { ApiErrorCode, NormalizedApiError } from './runtime-contracts.ts';

export const ERROR_CODES = Object.freeze([
  'AUTH_REQUIRED','AUTH_NOT_CONFIGURED','CSRF_REQUIRED','RATE_LIMITED',
  'INVALID_CHAT_REQUEST','INVALID_AGENT','TOOL_NOT_AUTHORIZED','TOOL_UNAVAILABLE',
  'INVALID_TOOL_ARGUMENTS','BODY_TOO_LARGE','NVIDIA_NOT_CONFIGURED','NVIDIA_CHAT_ERROR',
  'INVALID_NVIDIA_RESPONSE','INVALID_TOOL_CALL','SCHEDULE_COMMAND_FAILED',
  'SCHEDULE_EXECUTION_FAILED','SCHEDULE_LEASE_BUSY','SCHEDULE_CAPACITY_REACHED',
  'SCHEDULE_NOT_FOUND','SCHEDULE_NOT_CANCELLABLE','INVALID_SCHEDULE_COMMAND',
  'INVALID_SCHEDULE','DELEGATED_AGENT_FAILED'
] as const satisfies readonly ApiErrorCode[]);

const KNOWN = new Set<string>(ERROR_CODES);

function code(value: unknown): ApiErrorCode {
  const clean = typeof value === 'string' ? value.trim() : '';
  return (KNOWN.has(clean) ? clean : 'INTERNAL_ERROR') as ApiErrorCode;
}

function message(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500) : '';
}

export interface ApiErrorInput {
  readonly code?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
  readonly requestId?: unknown;
}

export function normalizeApiError(input: ApiErrorInput = {}): NormalizedApiError {
  const status = Number(input.status);
  const safeStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  const requestId = typeof input.requestId === 'string' && input.requestId.trim()
    ? input.requestId.trim().slice(0, 120)
    : undefined;
  return Object.freeze({
    error: code(input.code),
    status: safeStatus,
    message: message(input.message),
    ...(requestId ? { requestId } : {})
  });
}

export function isRetryableApiError(input: ApiErrorInput): boolean {
  const status = normalizeApiError(input).status;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function mapToolFailureToApiError(
  result: { readonly error?: unknown; readonly status?: unknown },
  requestId: string | null = null
): NormalizedApiError {
  const rawCode = typeof result.error === 'string' ? result.error : 'TOOL_EXECUTION_FAILED';
  const status = Number(result.status);
  return normalizeApiError({
    code: rawCode,
    status: Number.isInteger(status) ? status : rawCode === 'TOOL_NOT_AUTHORIZED' ? 403 : 502,
    requestId
  });
}

export const API_ERROR_CONTRACT = Object.freeze({
  codes: ERROR_CODES,
  maxMessageLength: 500,
  maxRequestIdLength: 120
});
