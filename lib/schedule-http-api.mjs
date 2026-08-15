const SCHEDULES_PATH = '/api/schedules';

function response(status, body, headers = {}) {
  return { matched: true, status, body, headers };
}

function commandErrorStatus(error) {
  if (error === 'AUTH_REQUIRED') return 401;
  if (error === 'INVALID_SCHEDULE_COMMAND' || error === 'INVALID_AGENT' || error === 'INVALID_SCHEDULE') return 400;
  if (error === 'SCHEDULE_NOT_FOUND') return 404;
  if (error === 'SCHEDULE_NOT_CANCELLABLE' || error === 'SCHEDULE_NOT_RESCHEDULABLE') return 409;
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

export function createScheduleHttpApi({ authenticator, commands, readJson } = {}) {
  if (typeof authenticator?.authenticate !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:authenticator');
  if (
    typeof commands?.create !== 'function' || typeof commands?.list !== 'function' ||
    typeof commands?.reschedule !== 'function' || typeof commands?.cancel !== 'function'
  ) throw new Error('INVALID_SCHEDULE_HTTP_API:commands');
  if (typeof readJson !== 'function') throw new Error('INVALID_SCHEDULE_HTTP_API:readJson');

  async function handle({ request, method, pathname, headers } = {}) {
    const verb = typeof method === 'string' ? method.toUpperCase() : '';
    const path = typeof pathname === 'string' ? pathname : '';
    const root = path === SCHEDULES_PATH;
    const scheduleId = root ? null : scheduleIdFromPath(path);
    if (!root && scheduleId === null) return { matched: false };
    if (!root && !scheduleId) return response(404, { error: 'SCHEDULE_NOT_FOUND' });

    let auth;
    try { auth = authenticator.authenticate({ headers }); } catch { auth = null; }
    if (!auth?.ok || !auth.principal) {
      return response(401, { error: 'AUTH_REQUIRED' }, { 'WWW-Authenticate': 'Bearer' });
    }

    if (root && verb === 'GET') {
      return commandResponse(await commands.list({ principal: auth.principal }), 200);
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
