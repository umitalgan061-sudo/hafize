const JSON_HEADERS = Object.freeze({ 'Cache-Control': 'no-store' });
const DELETE_PATH = /^\/api\/memory\/(memory_[A-Za-z0-9_-]{8,80})$/;

function response(status, body) {
  return { matched: true, status, headers: JSON_HEADERS, body };
}

function statusFor(error) {
  if (error === 'MEMORY_AUTH_REQUIRED' || error === 'AUTH_REQUIRED') return 401;
  if (error === 'MEMORY_NOT_FOUND') return 404;
  if (error === 'MEMORY_PERSISTENCE_SAVE_FAILED') return 503;
  return 400;
}

function sanitize(result) {
  if (!result?.ok) {
    const error = typeof result?.error === 'string' ? result.error : 'MEMORY_OPERATION_FAILED';
    return response(statusFor(error), { error });
  }
  if (Array.isArray(result.records)) return response(200, { records: result.records });
  if (result.record) return response(201, { record: result.record });
  if (typeof result.memoryId === 'string') return response(200, { memoryId: result.memoryId });
  return response(500, { error: 'MEMORY_OPERATION_FAILED' });
}

export function createPersonalMemoryHttpApi({ authenticator, service } = {}) {
  if (typeof authenticator?.authenticate !== 'function') throw new Error('INVALID_MEMORY_HTTP_API:authenticator');
  if (!service || typeof service !== 'object') throw new Error('INVALID_MEMORY_HTTP_API:service');
  for (const method of ['read', 'write', 'remove']) {
    if (typeof service[method] !== 'function') throw new Error(`INVALID_MEMORY_HTTP_API:service.${method}`);
  }

  function principalFor(headers) {
    const auth = authenticator.authenticate({ headers });
    return auth?.ok && auth.principal ? auth.principal : null;
  }

  async function handle({ method, pathname, headers, body } = {}) {
    const verb = typeof method === 'string' ? method.toUpperCase() : '';
    const path = typeof pathname === 'string' ? pathname : '';
    const deleteMatch = DELETE_PATH.exec(path);
    const matched = path === '/api/memory/query' || path === '/api/memory/write' || Boolean(deleteMatch);
    if (!matched) return { matched: false };

    const principal = principalFor(headers);
    if (!principal) return response(401, { error: 'AUTH_REQUIRED' });

    if (path === '/api/memory/query') {
      if (verb !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
      return sanitize(service.read(principal, body));
    }
    if (path === '/api/memory/write') {
      if (verb !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
      return sanitize(await service.write(principal, body));
    }
    if (verb !== 'DELETE') return response(405, { error: 'METHOD_NOT_ALLOWED' });
    if (!body || Array.isArray(body) || typeof body !== 'object') return response(400, { error: 'INVALID_MEMORY_SERVICE:remove' });
    if (Object.hasOwn(body, 'memoryId') || Object.hasOwn(body, 'ownerId')) {
      return response(400, { error: 'INVALID_MEMORY_SERVICE:remove' });
    }
    return sanitize(await service.remove(principal, { ...body, memoryId: deleteMatch[1] }));
  }

  return Object.freeze({ handle });
}
