const ERROR_CODES = Object.freeze([
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
]);
const KNOWN = new Set(ERROR_CODES);

function cleanCode(value) {
  const code = typeof value === 'string' ? value.trim() : '';
  return KNOWN.has(code) ? code : 'INTERNAL_ERROR';
}

function cleanMessage(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500);
}

/**
 * API hatasını tek ve makine tarafından okunabilir bir şekle indirger.
 * Gövdede asla yığın izi, dosya yolu veya secret bulunmaz.
 */
export function normalizeApiError({ code, status = 500, message = '', requestId = null }: { code?: unknown; status?: number; message?: unknown; requestId?: string | null } = {}): Readonly<{ error: string; status: number; message: string; requestId?: string }> {
  const normalizedStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  const normalizedRequestId = typeof requestId === 'string' && requestId.trim() ? requestId.trim().slice(0, 120) : null;
  // `requestId` yalnızca çağıran verdiğinde eklenir, bu yüzden isteğe bağlı.
  const payload: { error: string; status: number; message: string; requestId?: string } = {
    error: cleanCode(code),
    status: normalizedStatus,
    message: cleanMessage(message)
  };
  if (normalizedRequestId) payload.requestId = normalizedRequestId;
  return Object.freeze(payload);
}

export function isRetryableApiError(error: { code?: unknown; status?: number; message?: unknown; requestId?: string | null }): boolean {
  const normalized = normalizeApiError(error);
  return normalized.status === 408 || normalized.status === 425 || normalized.status === 429 || normalized.status >= 500;
}

export function mapToolFailureToApiError(result: { error?: unknown; status?: number } | null | undefined, requestId: string | null = null) {
  const code = typeof result?.error === 'string' ? result.error : 'TOOL_EXECUTION_FAILED';
  const status = Number.isInteger(result?.status) ? result.status : (code === 'TOOL_NOT_AUTHORIZED' ? 403 : 502);
  return normalizeApiError({ code, status, requestId });
}

export const API_ERROR_CONTRACT = Object.freeze({ codes: ERROR_CODES, maxMessageLength: 500, maxRequestIdLength: 120 });
