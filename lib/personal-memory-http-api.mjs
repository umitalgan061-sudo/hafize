const WRITE_FIELDS = new Set(['kind', 'content', 'sourceType', 'sourceRef', 'sensitivity', 'explicitUserIntent']);
const DELETE_FIELDS = new Set(['exactMatch', 'explicitUserIntent']);
const OWNER_FIELDS = new Set(['explicitUserIntent']);
const DELETE_ALL_FIELDS = new Set(['explicitUserIntent', 'confirmDeleteAll']);

function invalid(error = 'INVALID_MEMORY_REQUEST') { return { status: 400, body: { error } }; }
function cleanRecord(record) {
  if (!record || Array.isArray(record) || typeof record !== 'object') return null;
  const { ownerId: _ownerId, ...publicRecord } = record;
  return publicRecord;
}
function cleanResult(result) {
  if (!result?.ok) return { status: 400, body: { error: typeof result?.error === 'string' ? result.error : 'MEMORY_OPERATION_FAILED' } };
  const body = { ok: true };
  if (Array.isArray(result.records)) body.records = result.records.map(cleanRecord).filter(Boolean);
  if (result.record) body.record = cleanRecord(result.record);
  if (Number.isInteger(result.deleted)) body.deleted = result.deleted;
  return { status: 200, body };
}
function exactObject(value, fields) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  return Object.keys(value).every((key) => fields.has(key));
}
function queryInput(url) {
  const query = url.searchParams.get('query') || '';
  const kindsText = url.searchParams.get('kinds') || '';
  const kinds = kindsText ? kindsText.split(',').map((item) => item.trim()).filter(Boolean) : [];
  const limitText = url.searchParams.get('limit');
  const limit = limitText == null ? undefined : Number(limitText);
  return { query, ...(kinds.length ? { kinds } : {}), ...(limitText == null ? {} : { limit }) };
}

export function createPersonalMemoryHttpApi({ runtime, readJson } = {}) {
  if (!runtime || typeof runtime.authenticate !== 'function') throw new Error('INVALID_MEMORY_HTTP_API:runtime');
  if (runtime.configured !== true) throw new Error('INVALID_MEMORY_HTTP_API:notConfigured');
  if (typeof readJson !== 'function') throw new Error('INVALID_MEMORY_HTTP_API:readJson');

  async function handle({ request, method, pathname, url, headers } = {}) {
    if (pathname !== '/api/memory' && !pathname?.startsWith('/api/memory/')) return { matched: false };
    const ownership = runtime.authenticate(headers);
    if (!ownership) return { matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } };
    const ownerId = ownership.ownerId;

    if (method === 'GET' && pathname === '/api/memory') {
      const result = runtime.memory.read({ ownerId, ...queryInput(url) });
      return { matched: true, ...cleanResult(result) };
    }
    if (method === 'POST' && pathname === '/api/memory/export') {
      const body = await readJson(request);
      if (!exactObject(body, OWNER_FIELDS) || body.explicitUserIntent !== true) {
        return { matched: true, ...invalid('MEMORY_EXPORT_REQUIRES_EXPLICIT_USER_INTENT') };
      }
      return { matched: true, ...cleanResult(runtime.memory.exportOwner({ ownerId, explicitUserIntent: true })) };
    }
    if (method === 'DELETE' && pathname === '/api/memory') {
      const body = await readJson(request);
      if (!exactObject(body, DELETE_ALL_FIELDS) || body.explicitUserIntent !== true || body.confirmDeleteAll !== true) {
        return { matched: true, ...invalid('MEMORY_DELETE_ALL_REQUIRES_CONFIRMATION') };
      }
      return { matched: true, ...cleanResult(await runtime.memory.deleteOwner({ ownerId, confirmOwnerId: ownerId, explicitUserIntent: true })) };
    }
    if (method === 'POST' && pathname === '/api/memory') {
      const body = await readJson(request);
      if (!exactObject(body, WRITE_FIELDS) || body.explicitUserIntent !== true) {
        return { matched: true, ...invalid('MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT') };
      }
      return { matched: true, ...cleanResult(await runtime.memory.write({ ownerId, ...body })) };
    }
    const match = /^\/api\/memory\/(memory_[A-Za-z0-9_-]{8,80})$/.exec(pathname || '');
    if (method === 'DELETE' && match) {
      const body = await readJson(request);
      if (!exactObject(body, DELETE_FIELDS) || body.explicitUserIntent !== true || body.exactMatch !== true) {
        return { matched: true, ...invalid('MEMORY_DELETE_REQUIRES_EXPLICIT_USER_INTENT') };
      }
      return { matched: true, ...cleanResult(await runtime.memory.remove({ ownerId, memoryId: match[1], exactMatch: true })) };
    }
    return { matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
  }

  return Object.freeze({ handle });
}
