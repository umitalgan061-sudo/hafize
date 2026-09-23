export type JsonRecord = Record<string, unknown>;

export interface AuthenticatedPrincipal {
  readonly authenticated: true;
  readonly subject: string;
}

export interface AuthFailure {
  readonly ok: false;
  readonly error: 'AUTH_REQUIRED' | 'AUTH_EXPIRED';
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

/**
 * GitHub read boundaries always call their injected fetch with a fully built
 * `URL` and an explicit `RequestInit`. Narrowing the injected signature keeps
 * the call sites honest and lets tests observe the request without casting.
 * The global `fetch` stays assignable because it accepts a wider first
 * argument.
 */
export type GitHubApiFetch = (url: URL, init: RequestInit) => Promise<Response>;

/**
 * Canva and Gmail expose the same read-only tool shape: an argument validator
 * in front of a provider client, with the owner resolved from the request
 * principal. The contract lives here so both boundaries stay interchangeable.
 */
export interface ReadToolOwnerResolver {
  readonly resolve: (principal: unknown) => { readonly ownerId?: unknown } | null | undefined;
}

export interface ReadToolClient {
  readonly read: (request: { readonly ownerId: string; readonly operation: string; readonly params?: unknown }) => Promise<JsonRecord>;
}

export interface ReadToolBoundaryOptions {
  readonly readClient?: ReadToolClient | undefined;
  readonly ownerResolver?: ReadToolOwnerResolver | undefined;
}

export interface ReadToolBoundary {
  readonly execute: (args: unknown, context?: { readonly principal?: unknown }) => Promise<JsonRecord>;
}
