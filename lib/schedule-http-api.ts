import { normalizeApiError } from './api-error-contract.ts';
import type { AuthenticatedPrincipal, AuthenticationResult, JsonRecord, NormalizedApiError } from './runtime-contracts.ts';

const SCHEDULES_PATH = '/api/schedules';
const MAX_SCHEDULE_ID = 120;
const UNSAFE_SCHEDULE_ID = /[/\\\u0000-\u001f\u007f]/;

export interface ScheduleHttpHeaders {
  readonly [key: string]: unknown;
}

export interface ScheduleCommandOutput {
  readonly ok?: unknown;
  readonly error?: unknown;
  readonly [key: string]: unknown;
}

export interface ScheduleCommands {
  readonly list: (input: { readonly principal: AuthenticatedPrincipal }) => Promise<ScheduleCommandOutput>;
  readonly create: (input: { readonly principal: AuthenticatedPrincipal; readonly input: unknown }) => Promise<ScheduleCommandOutput>;
  readonly cancel: (input: { readonly principal: AuthenticatedPrincipal; readonly scheduleId: string }) => Promise<ScheduleCommandOutput>;
}

export interface ScheduleHttpAuthenticator {
  readonly authenticate: (input: { readonly headers?: unknown }) => AuthenticationResult | null | undefined;
}

export interface ScheduleHttpApiOptions {
  readonly authenticator: ScheduleHttpAuthenticator;
  readonly commands: ScheduleCommands;
  readonly readJson: (request: unknown) => Promise<unknown>;
}

export interface ScheduleHttpRequest {
  readonly request?: unknown;
  readonly method?: unknown;
  readonly pathname?: unknown;
  readonly headers?: unknown;
}

export type ScheduleHttpResponse =
  | { readonly matched: false }
  | {
      readonly matched: true;
      readonly status: number;
      readonly body: ScheduleCommandOutput | NormalizedApiError;
      readonly headers: Readonly<Record<string, string>>;
    };

export interface ScheduleHttpApi {
  readonly handle: (input?: ScheduleHttpRequest) => Promise<ScheduleHttpResponse>;
}

function response(
  status: number,
  body: ScheduleCommandOutput | NormalizedApiError,
  headers: Readonly<Record<string, string>> = {}
): ScheduleHttpResponse {
  return { matched: true, status, body, headers };
}

function commandErrorStatus(error: string): number {
  if (error === 'AUTH_REQUIRED') return 401;
  if (error === 'INVALID_SCHEDULE_COMMAND' || error === 'INVALID_AGENT' || error === 'INVALID_SCHEDULE') return 400;
  if (error === 'SCHEDULE_NOT_FOUND') return 404;
  if (error === 'SCHEDULE_NOT_CANCELLABLE') return 409;
  if (error === 'SCHEDULE_CAPACITY_REACHED') return 503;
  return 500;
}

function requestIdFromHeaders(headers: unknown): string | null {
  if (!headers || typeof headers !== 'object') return null;
  const record = headers as JsonRecord;
  const value = record['x-hafize-request-id'] ?? record['X-Hafize-Request-Id'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function commandResponse(
  output: ScheduleCommandOutput,
  successStatus: number,
  requestId: string | null
): ScheduleHttpResponse {
  if (output?.ok) return response(successStatus, output);
  const error = typeof output?.error === 'string' ? output.error : 'SCHEDULE_COMMAND_FAILED';
  const normalized = normalizeApiError({
    code: error,
    status: commandErrorStatus(error),
    requestId
  });
  return response(normalized.status, normalized, requestId ? { 'X-Hafize-Request-Id': requestId } : {});
}

/**
 * Returns `null` when the path is not a schedule item path at all, `''` when it
 * looks like one but carries an unusable identifier, and the identifier
 * otherwise. Percent-encoded separators (`%2F`), control characters and
 * relative segments decode into values that must never reach the command
 * layer, so they are rejected here rather than downstream.
 */
function scheduleIdFromPath(pathname: string): string | null {
  const prefix = `${SCHEDULES_PATH}/`;
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length);
  if (!raw || raw.includes('/')) return '';
  let id: string;
  try {
    id = decodeURIComponent(raw).trim();
  } catch {
    return '';
  }
  if (!id || id.length > MAX_SCHEDULE_ID) return '';
  if (id === '.' || id === '..' || UNSAFE_SCHEDULE_ID.test(id)) return '';
  return id;
}

export function createScheduleHttpApi(options: ScheduleHttpApiOptions): ScheduleHttpApi {
  const { authenticator, commands, readJson } = options ?? ({} as ScheduleHttpApiOptions);
  if (typeof authenticator?.authenticate !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:authenticator');
  if (
    typeof commands?.create !== 'function' ||
    typeof commands?.list !== 'function' ||
    typeof commands?.cancel !== 'function'
  ) throw new Error('INVALID_SCHEDULE_HTTP_API:commands');
  if (typeof readJson !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:readJson');

  async function handle(input: ScheduleHttpRequest = {}): Promise<ScheduleHttpResponse> {
    const { request, method, pathname, headers } = input;
    const verb = typeof method === 'string' ? method.toUpperCase() : '';
    const path = typeof pathname === 'string' ? pathname : '';
    const root = path === SCHEDULES_PATH;
    const scheduleId = root ? null : scheduleIdFromPath(path);
    const requestId = requestIdFromHeaders(headers);
    if (!root && scheduleId === null) return { matched: false };
    if (!root && !scheduleId) {
      const normalized = normalizeApiError({ code: 'SCHEDULE_NOT_FOUND', status: 404, requestId });
      return response(404, normalized, requestId ? { 'X-Hafize-Request-Id': requestId } : {});
    }

    let auth: AuthenticationResult | null | undefined;
    try {
      auth = authenticator.authenticate({ headers });
    } catch {
      auth = null;
    }
    if (!auth?.ok || !auth.principal) {
      const normalized = normalizeApiError({ code: 'AUTH_REQUIRED', status: 401, requestId });
      return response(401, normalized, {
        ...(requestId ? { 'X-Hafize-Request-Id': requestId } : {}),
        'WWW-Authenticate': 'Bearer'
      });
    }
    const principal = auth.principal;

    if (root && verb === 'GET') {
      return commandResponse(await commands.list({ principal }), 200, requestId);
    }
    if (root && verb === 'POST') {
      const body = await readJson(request);
      return commandResponse(await commands.create({ principal, input: body }), 201, requestId);
    }
    if (!root && verb === 'DELETE' && scheduleId) {
      return commandResponse(await commands.cancel({ principal, scheduleId }), 200, requestId);
    }
    const normalized = normalizeApiError({ code: 'INVALID_SCHEDULE_COMMAND', status: 405, requestId });
    return response(405, normalized, {
      ...(requestId ? { 'X-Hafize-Request-Id': requestId } : {}),
      Allow: root ? 'GET, POST' : 'DELETE'
    });
  }

  return Object.freeze({ handle });
}
