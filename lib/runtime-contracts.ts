export type JsonRecord = Record<string, unknown>;

export interface AuthenticatedPrincipal {
  readonly authenticated: true;
  readonly subject: string;
}

export interface AuthFailure {
  readonly ok: false;
  readonly error: 'AUTH_REQUIRED';
}

export type AuthenticationResult =
  | AuthFailure
  | { readonly ok: true; readonly principal: AuthenticatedPrincipal };

export interface RateLimitAllowed {
  readonly ok: true;
  readonly release: () => void;
}

export interface RateLimitDenied {
  readonly ok: false;
  readonly retryAfterSeconds: number;
  readonly concurrent?: boolean;
}

export type RateLimitDecision = RateLimitAllowed | RateLimitDenied;

export type RequestFailureClassification = 'closed' | 'aborted' | 'stream' | 'json';

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_NOT_CONFIGURED'
  | 'CSRF_REQUIRED'
  | 'RATE_LIMITED'
  | 'INVALID_CHAT_REQUEST'
  | 'INVALID_AGENT'
  | 'TOOL_NOT_AUTHORIZED'
  | 'TOOL_UNAVAILABLE'
  | 'INVALID_TOOL_ARGUMENTS'
  | 'BODY_TOO_LARGE'
  | 'NVIDIA_NOT_CONFIGURED'
  | 'NVIDIA_CHAT_ERROR'
  | 'INVALID_NVIDIA_RESPONSE'
  | 'INVALID_TOOL_CALL'
  | 'SCHEDULE_COMMAND_FAILED'
  | 'SCHEDULE_EXECUTION_FAILED'
  | 'SCHEDULE_LEASE_BUSY'
  | 'SCHEDULE_CAPACITY_REACHED'
  | 'SCHEDULE_NOT_FOUND'
  | 'SCHEDULE_NOT_CANCELLABLE'
  | 'INVALID_SCHEDULE_COMMAND'
  | 'INVALID_SCHEDULE'
  | 'DELEGATED_AGENT_FAILED'
  | 'INTERNAL_ERROR'
  | 'TOOL_EXECUTION_FAILED';

export interface NormalizedApiError {
  readonly error: ApiErrorCode;
  readonly status: number;
  readonly message: string;
  readonly requestId?: string;
}

export interface SecurityEvent {
  readonly timestamp: string;
  readonly event: string;
  readonly requestId: string;
  readonly route: string;
  readonly method: string;
  readonly outcome: string;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface TaskLedgerEntry {
  readonly taskId: string;
  readonly traceId: string;
  readonly agentId: string;
  readonly action: string;
  readonly status: string;
  readonly parentTaskId?: string | null;
  readonly detail?: string | null;
  readonly [key: string]: unknown;
}

export interface TaskLedgerSnapshot {
  readonly entries: readonly TaskLedgerEntry[];
  readonly [key: string]: unknown;
}
