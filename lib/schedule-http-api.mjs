import {
  boundScheduleListOutput,
  normalizeScheduleListLimit,
  normalizeScheduleListOffset,
  normalizeScheduleListSnapshot
} from './schedule-list-boundary.mjs';
import {
  attachScheduleListScopeCounts,
  createScheduleListScopeCounts,
  filterScheduleListOutput,
  normalizeScheduleListScope
} from './schedule-list-scope.mjs';
import { normalizeScheduleListView, summarizeScheduleListOutput } from './schedule-list-summary.mjs';
import { authenticateSchedulePrincipal, createOptionalScheduleSessionAuthenticator } from './schedule-session-auth.mjs';

const SCHEDULES_PATH = '/api/schedules';
const LIST_QUERY_FIELDS = new Set(['limit', 'offset', 'snapshot', 'view', 'scope']);
const CANONICAL_INTEGER = /^(?:0|[1-9][0-9]*)$/;

function response(status, body, headers = {}) {
  return { matched: true, status, body, headers };
}

function commandErrorStatus(error) {
  if (error === 'AUTH_REQUIRED') return 401;
  if (
    error === 'INVALID_SCHEDULE_COMMAND' || error === 'INVALID_AGENT' || error === 'INVALID_SCHEDULE' ||
    error === 'SCHEDULE_LIST_SNAPSHOT_REQUIRED'
  ) return 400;
  if (error === 'SCHEDULE_NOT_FOUND') return 404;
  if (
    error === 'SCHEDULE_NOT_CANCELLABLE' || error === 'SCHEDULE_NOT_RESCHEDULABLE' ||
    error === 'SCHEDULE_LIST_SNAPSHOT_CHANGED'
  ) return 409;
  if (error === 'SCHEDULE_CAPACITY_REACHED') return 503;
  return 500;
}

function commandResponse(output, successStatus) {
  if (output?.ok) return response(successStatus, output);
  const error = typeof output?.error === 'string' ? output.error : 'SCHEDULE_COMMAND_FAILED';
  return response(commandErrorStatus(error), { error });
}

function scheduleIdFromPath(pathname) {
  const prefix = `${SCHEDULES_PATH}/`;
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length);
  if (!raw || raw.includes('/')) return '';
  try {
    const id = decodeURIComponent(raw).trim();
    return id && id.length <= 120 ? id : '';
  } catch {
    return '';
  }
}

function parseListQuery(request, serverLimit) {
  let url;
  try {
    url = new URL(request?.url || SCHEDULES_PATH, 'http://hafize.local');
  } catch {
    return null;
  }
  for (const key of url.searchParams.keys()) if (!LIST_QUERY_FIELDS.has(key)) return null;
  for (const key of LIST_QUERY_FIELDS) if (url.searchParams.getAll(key).length > 1) return null;

  const rawLimit = url.searchParams.get('limit');
  const rawOffset = url.searchParams.get('offset');
  const rawSnapshot = url.searchParams.get('snapshot');
  const rawView = url.searchParams.get('view');
  const rawScope = url.searchParams.get('scope');
  if (rawLimit != null && (!CANONICAL_INTEGER.test(rawLimit) || rawLimit === '0')) return null;
  if (rawOffset != null && !CANONICAL_INTEGER.test(rawOffset)) return null;

  try {
    const limit = rawLimit == null ? serverLimit : normalizeScheduleListLimit(Number(rawLimit));
    const offset = rawOffset == null ? 0 : normalizeScheduleListOffset(Number(rawOffset));
    const snapshot = rawSnapshot == null ? null : normalizeScheduleListSnapshot(rawSnapshot);
    const view = normalizeScheduleListView(rawView);
    const scope = normalizeScheduleListScope(rawScope);
    if (limit > serverLimit) return null;
    if (offset > 0 && snapshot === null) return null;
    if (offset === 0 && snapshot !== null) return null;
    return { limit, offset, snapshot, view, scope };
  } catch {
    return null;
  }
}

export function createScheduleHttpApi({
  authenticator,
  sessionAuthenticator = createOptionalScheduleSessionAuthenticator(),
  commands,
  readJson,
  listLimit
} = {}) {
  if (typeof authenticator?.authenticate !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:authenticator');
  if (sessionAuthenticator != null && typeof sessionAuthenticator?.authenticate !== 'function') {
    throw new Error('INVALID_SCHEDULE_HTTP_API:sessionAuthenticator');
  }
  if (
    typeof commands?.create !== 'function' || typeof commands?.list !== 'function' ||
    typeof commands?.reschedule !== 'function' || typeof commands?.cancel !== 'function'
  ) throw new Error('INVALID_SCHEDULE_HTTP_API:commands');
  if (typeof readJson !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:readJson');
  const serverListLimit = normalizeScheduleListLimit(listLimit);

  async function handle({ request, method, pathname, headers } = {}) {
    const verb = typeof method === 'string' ? method.toUpperCase() : '';
    const path = typeof pathname === 'string' ? pathname : '';
    const root = path === SCHEDULES_PATH;
    const scheduleId = root ? null : scheduleIdFromPath(path);
    if (!root && scheduleId === null) return { matched: false };
    if (!root && !scheduleId) return response(404, { error: 'SCHEDULE_NOT_FOUND' });

    const auth = authenticateSchedulePrincipal({
      primaryAuthenticator: authenticator,
      sessionAuthenticator,
      headers,
      requireSessionOrigin: verb === 'POST' || verb === 'PATCH' || verb === 'DELETE'
    });
    if (!auth.ok || !auth.principal) {
      return response(401, { error: 'AUTH_REQUIRED' }, { 'WWW-Authenticate': 'Bearer' });
    }

    if (root && verb === 'GET') {
      const pagination = parseListQuery(request, serverListLimit);
      if (!pagination) return response(400, { error: 'INVALID_SCHEDULE_LIST_QUERY' });
      const output = await commands.list({ principal: auth.principal });
      const scopeCounts = createScheduleListScopeCounts(output);
      const scoped = filterScheduleListOutput(output, pagination.scope);
      const bounded = boundScheduleListOutput(scoped, pagination);
      const projected = pagination.view === 'summary' ? summarizeScheduleListOutput(bounded) : bounded;
      const counted = scopeCounts && projected?.ok ? attachScheduleListScopeCounts(projected, scopeCounts) : projected;
      return commandResponse(counted, 200);
    }
    if (root && verb === 'POST') {
      const input = await readJson(request);
      return commandResponse(await commands.create({ principal: auth.principal, input }), 201);
    }
    if (!root && verb === 'PATCH') {
      const input = await readJson(request);
      return commandResponse(await commands.reschedule({ principal: auth.principal, scheduleId, input }), 200);
    }
    if (!root && verb === 'DELETE') {
      return commandResponse(await commands.cancel({ principal: auth.principal, scheduleId }), 200);
    }
    return response(405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: root ? 'GET, POST' : 'PATCH, DELETE' });
  }

  return Object.freeze({ handle });
}

export { parseListQuery };
