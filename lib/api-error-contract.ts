import type { ApiErrorCode, NormalizedApiError } from './runtime-contracts.ts';

export const ERROR_CODES = Object.freeze([
  'AUTH_REQUIRED','AUTH_NOT_CONFIGURED','CSRF_REQUIRED','RATE_LIMITED','INVALID_CHAT_REQUEST',
  'INVALID_AGENT','TOOL_NOT_AUTHORIZED','TOOL_UNAVAILABLE','INVALID_TOOL_ARGUMENTS','BODY_TOO_LARGE',
  'NVIDIA_NOT_CONFIGURED','NVIDIA_CHAT_ERROR','INVALID_NVIDIA_RESPONSE','SCHEDULE_COMMAND_FAILED',
  'SCHEDULE_EXECUTION_FAILED','SCHEDULE_LEASE_BUSY','SCHEDULE_CAPACITY_REACHED','SCHEDULE_NOT_FOUND',
  'SCHEDULE_NOT_CANCELLABLE','INVALID_SCHEDULE_COMMAND','INVALID_SCHEDULE','DELEGATED_AGENT_FAILED'
] as const satisfies readonly ApiErrorCode[]);
const KNOWN = new Set<string>(ERROR_CODES);
function cleanCode(value: unknown): ApiErrorCode {
  const code = typeof value === 'string' ? value.trim() : '';
  return (KNOWN.has(code) ? code : 'INTERNAL_ERROR') as ApiErrorCode;
}
function cleanMessage(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500) : '';
}
export interface ApiErrorInput {
  readonly code?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
  readonly requestId?: unknown;
}
export function normalizeApiError(input: ApiErrorInput = {}): NormalizedApiError {
  const normalizedStatus = Number.isInteger(input.status) && Number(input.status) >= 400 && Number(input.status) <= 599 ? Number(input.status) : 500;
  const normalizedRequestId = typeof input.requestId === 'string' && input.requestId.trim() ? input.requestId.trim().slice(0, 120) : undefined;
  return Object.freeze({
    error: cleanCode(input.code),
    status: normalizedStatus,
    message: cleanMessage(input.message),
    ...(normalizedRequestId ? { requestId: normalizedRequestId } : {})
  });
}
export function isRetryableApiError(error: ApiErrorInput): boolean {
  const normalized = normalizeApiError(error);
  return normalized.status === 408 || normalized.status === 425 || normalized.status === 429 || normalized.status >= 500;
}
export function mapToolFailureToApiError(result: { readonly error?: unknown; readonly status?: unknown }, requestId: string | null = null): NormalizedApiError {
  const code = typeof result?.error === 'string' ? result.error : 'TOOL_EXECUTION_FAILED';
  const numericStatus = Number(result?.status);
  const status = Number.isInteger(numericStatus) ? numericStatus : code === 'TOOL_NOT_AUTHORIZED' ? 403 : 502;
  return normalizeApiError({ code, status, requestId });
}
export const API_ERROR_CONTRACT = Object.freeze({ codes: ERROR_CODES, maxMessageLength: 500, maxRequestIdLength: 120 });