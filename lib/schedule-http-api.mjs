import { normalizeApiError } from './api-error-contract.mjs';

const SCHEDULES_PATH = '/api/schedules';
const STATS_PATH = '/api/schedules/stats';
const BULK_CANCEL_PATH = '/api/schedules/bulk-cancel';

function response(status, body, headers = {}) { return { matched: true, status, body, headers }; }
function commandErrorStatus(error) { if (error === 'AUTH_REQUIRED') return 401; if (error === 'INVALID_SCHEDULE_COMMAND' || error === 'INVALID_AGENT' || error === 'INVALID_SCHEDULE') return 400; if (error === 'SCHEDULE_NOT_FOUND') return 404; if (error === 'SCHEDULE_NOT_CANCELLABLE') return 409; if (error === 'SCHEDULE_CAPACITY_REACHED') return 503; return 500; }
function requestIdFromHeaders(headers) { const value = headers?.['x-hafize-request-id'] || headers?.['X-Hafize-Request-Id']; return typeof value === 'string' && value.trim() ? value.trim() : null; }
function commandResponse(output, successStatus, requestId) { if (output?.ok) return response(successStatus, output, requestId ? { 'X-Hafize-Request-Id': requestId } : {}); const error = typeof output?.error === 'string' ? output.error : 'SCHEDULE_COMMAND_FAILED'; const normalized = normalizeApiError({ code: error, status: commandErrorStatus(error), requestId }); return response(normalized.status, normalized, requestId ? { 'X-Hafize-Request-Id': requestId } : {}); }
function scheduleIdFromPath(pathname) { const prefix = `${SCHEDULES_PATH}/`; if (!pathname.startsWith(prefix)) return null; const raw = pathname.slice(prefix.length); if (!raw || raw.includes('/')) return ''; try { const id = decodeURIComponent(raw).trim(); return id && id.length <= 120 ? id : ''; } catch { return ''; } }
function parseListQuery(urlValue) { try { const url = new URL(urlValue || SCHEDULES_PATH, 'http://hafize.local'); const limitRaw = url.searchParams.get('limit'); const limit = limitRaw == null ? 50 : Number.parseInt(limitRaw, 10); const cursor = url.searchParams.get('cursor'); const q = url.searchParams.get('q') || ''; const status = url.searchParams.get('status') || 'all'; const sort = url.searchParams.get('sort') || 'runAt-asc'; if (!Number.isInteger(limit) || limit < 1 || limit > 100 || q.length > 160 || (cursor && cursor.length > 1024)) return null; return { limit, cursor: cursor || null, q: q.slice(0, 160), status, sort }; } catch { return null; } }

export function createScheduleHttpApi({ authenticator, commands, readJson } = {}) {
  if (typeof authenticator?.authenticate !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:authenticator');
  if (typeof commands?.create !== 'function' || typeof commands?.list !== 'function' || typeof commands?.stats !== 'function' || typeof commands?.cancel !== 'function' || typeof commands?.cancelMany !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:commands');
  if (typeof readJson !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:readJson');

  async function handle({ request, method, pathname, headers } = {}) {
    const verb = typeof method === 'string' ? method.toUpperCase() : ''; const path = typeof pathname === 'string' ? pathname : '';
    const root = path === SCHEDULES_PATH; const stats = path === STATS_PATH; const bulkCancel = path === BULK_CANCEL_PATH; const scheduleId = root || stats || bulkCancel ? null : scheduleIdFromPath(path); const requestId = requestIdFromHeaders(headers);
    if (!root && !stats && !bulkCancel && scheduleId === null) return { matched: false };
    if (!root && !stats && !bulkCancel && !scheduleId) return commandResponse({ ok: false, error: 'SCHEDULE_NOT_FOUND' }, 404, requestId);
    let auth; try { auth = authenticator.authenticate({ headers }); } catch { auth = null; }
    if (!auth?.ok || !auth.principal) { const normalized = normalizeApiError({ code: 'AUTH_REQUIRED', status: 401, requestId }); return response(401, normalized, { ...(requestId ? { 'X-Hafize-Request-Id': requestId } : {}), 'WWW-Authenticate': 'Bearer' }); }
    if (stats && verb === 'GET') return commandResponse(await commands.stats({ principal: auth.principal }), 200, requestId);
    if (root && verb === 'GET') { const query = parseListQuery(request?.url || SCHEDULES_PATH); if (!query) return commandResponse({ ok: false, error: 'INVALID_SCHEDULE_COMMAND' }, 400, requestId); return commandResponse(await commands.list({ principal: auth.principal, query }), 200, requestId); }
    if (root && verb === 'POST') return commandResponse(await commands.create({ principal: auth.principal, input: await readJson(request) }), 201, requestId);
    if (bulkCancel && verb === 'POST') { const input = await readJson(request); return commandResponse(await commands.cancelMany({ principal: auth.principal, scheduleIds: input?.scheduleIds }), 200, requestId); }
    if (!root && !stats && !bulkCancel && verb === 'DELETE') return commandResponse(await commands.cancel({ principal: auth.principal, scheduleId }), 200, requestId);
    const normalized = normalizeApiError({ code: 'INVALID_SCHEDULE_COMMAND', status: 405, requestId }); return response(405, normalized, { ...(requestId ? { 'X-Hafize-Request-Id': requestId } : {}), Allow: stats ? 'GET' : root ? 'GET, POST' : bulkCancel ? 'POST' : 'DELETE' });
  }
  return Object.freeze({ handle });
}
