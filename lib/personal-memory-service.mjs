const WRITE_FIELDS = new Set(['kind', 'content', 'sourceType', 'sourceRef', 'sensitivity', 'explicitUserIntent']);
const READ_FIELDS = new Set(['query', 'kinds', 'limit']);
const REMOVE_FIELDS = new Set(['memoryId', 'exactMatch', 'explicitUserIntent']);

function invalid(label) {
  return { ok: false, error: `INVALID_MEMORY_SERVICE:${label}` };
}

function exactObject(input, allowed) {
  if (!input || Array.isArray(input) || typeof input !== 'object') return null;
  for (const key of Object.keys(input)) if (!allowed.has(key)) return null;
  return input;
}

function publicRecord(record) {
  if (!record || Array.isArray(record) || typeof record !== 'object') return null;
  const { ownerId: _ownerId, ...safe } = record;
  return safe;
}

function safeResult(result) {
  if (!result?.ok) return { ok: false, error: typeof result?.error === 'string' ? result.error : 'MEMORY_OPERATION_FAILED' };
  return result;
}

export function createPersonalMemoryService({ persistence, resolveOwner } = {}) {
  if (!persistence || typeof persistence !== 'object') throw new Error('INVALID_MEMORY_SERVICE:persistence');
  for (const method of ['read', 'readForContext', 'write', 'remove']) {
    if (typeof persistence[method] !== 'function') throw new Error(`INVALID_MEMORY_SERVICE:persistence.${method}`);
  }
  if (typeof resolveOwner !== 'function') throw new Error('INVALID_MEMORY_SERVICE:resolveOwner');

  function ownerIdFor(principal) {
    let resolved;
    try {
      resolved = resolveOwner(principal);
    } catch {
      return null;
    }
    const ownerId = typeof resolved?.ownerId === 'string' ? resolved.ownerId.trim() : '';
    return ownerId || null;
  }

  function read(principal, input) {
    const body = exactObject(input, READ_FIELDS);
    if (!body) return invalid('read');
    const ownerId = ownerIdFor(principal);
    if (!ownerId) return { ok: false, error: 'MEMORY_AUTH_REQUIRED' };
    const result = safeResult(persistence.read({ ...body, ownerId }));
    if (!result.ok) return result;
    return { ok: true, records: result.records.map(publicRecord).filter(Boolean) };
  }

  function readForContext(principal, input) {
    const body = exactObject(input, READ_FIELDS);
    if (!body) return invalid('read');
    const ownerId = ownerIdFor(principal);
    if (!ownerId) return { ok: false, error: 'MEMORY_AUTH_REQUIRED' };
    const result = safeResult(persistence.readForContext({ ...body, ownerId }));
    if (!result.ok) return result;
    return {
      ok: true,
      records: Array.isArray(result.records) ? result.records.map(publicRecord).filter(Boolean) : [],
      context: typeof result.context === 'string' ? result.context : ''
    };
  }

  async function write(principal, input) {
    const body = exactObject(input, WRITE_FIELDS);
    if (!body) return invalid('write');
    if (body.explicitUserIntent !== true) return { ok: false, error: 'MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT' };
    const ownerId = ownerIdFor(principal);
    if (!ownerId) return { ok: false, error: 'MEMORY_AUTH_REQUIRED' };
    const result = safeResult(await persistence.write({ ...body, ownerId }));
    if (!result.ok) return result;
    const record = publicRecord(result.record);
    return record ? { ok: true, record } : { ok: false, error: 'MEMORY_OPERATION_FAILED' };
  }

  async function remove(principal, input) {
    const body = exactObject(input, REMOVE_FIELDS);
    if (!body) return invalid('remove');
    if (body.explicitUserIntent !== true) return { ok: false, error: 'MEMORY_DELETE_REQUIRES_EXPLICIT_USER_INTENT' };
    const ownerId = ownerIdFor(principal);
    if (!ownerId) return { ok: false, error: 'MEMORY_AUTH_REQUIRED' };
    const { explicitUserIntent: _intent, ...command } = body;
    return safeResult(await persistence.remove({ ...command, ownerId }));
  }

  return Object.freeze({ read, readForContext, write, remove });
}
