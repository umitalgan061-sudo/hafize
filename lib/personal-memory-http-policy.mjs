import { PERSONAL_MEMORY_CONTRACT } from './personal-memory-contract.mjs';

const READ_QUERY_FIELDS = new Set(['query', 'kinds', 'limit']);
const WRITE_FIELDS = new Set(['kind', 'content', 'sourceType', 'sourceRef', 'sensitivity', 'explicitUserIntent']);
const DELETE_FIELDS = new Set(['exactMatch', 'explicitUserIntent']);
const OWNER_FIELDS = new Set(['explicitUserIntent']);
const DELETE_ALL_FIELDS = new Set(['explicitUserIntent', 'confirmDeleteAll']);
const MEMORY_ID_PATTERN = /^memory_[A-Za-z0-9_-]{8,80}$/;

function invalid(error) {
  return Object.freeze({ ok: false, error });
}

function success(value) {
  return Object.freeze({ ok: true, value: Object.freeze(value) });
}

function exactObject(value, allowed) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  return Object.keys(value).every((key) => allowed.has(key));
}

function singleParam(url, name) {
  const values = url.searchParams.getAll(name);
  if (values.length > 1) return invalid('INVALID_MEMORY_QUERY_DUPLICATE');
  return { ok: true, value: values[0] };
}

export function parseMemoryReadQuery(url) {
  if (!(url instanceof URL)) return invalid('INVALID_MEMORY_QUERY');
  for (const key of url.searchParams.keys()) {
    if (!READ_QUERY_FIELDS.has(key)) return invalid('INVALID_MEMORY_QUERY_FIELD');
  }

  const queryParam = singleParam(url, 'query');
  const kindsParam = singleParam(url, 'kinds');
  const limitParam = singleParam(url, 'limit');
  if (!queryParam.ok || !kindsParam.ok || !limitParam.ok) return invalid('INVALID_MEMORY_QUERY_DUPLICATE');

  const query = typeof queryParam.value === 'string' ? queryParam.value.trim() : '';
  if (!query || query.length > PERSONAL_MEMORY_CONTRACT.maxQueryLength) {
    return invalid('INVALID_MEMORY_QUERY');
  }

  const kinds = [];
  if (typeof kindsParam.value === 'string' && kindsParam.value.trim()) {
    const rawKinds = kindsParam.value.split(',');
    if (rawKinds.length > PERSONAL_MEMORY_CONTRACT.kinds.length) return invalid('INVALID_MEMORY_QUERY_KINDS');
    for (const rawKind of rawKinds) {
      const kind = rawKind.trim();
      if (!kind || !PERSONAL_MEMORY_CONTRACT.kinds.includes(kind) || kinds.includes(kind)) {
        return invalid('INVALID_MEMORY_QUERY_KINDS');
      }
      kinds.push(kind);
    }
  }

  let limit;
  if (limitParam.value !== undefined) {
    if (!/^[1-9][0-9]*$/.test(limitParam.value)) return invalid('INVALID_MEMORY_QUERY_LIMIT');
    limit = Number(limitParam.value);
    if (!Number.isSafeInteger(limit) || limit > PERSONAL_MEMORY_CONTRACT.maxReadLimit) {
      return invalid('INVALID_MEMORY_QUERY_LIMIT');
    }
  }

  return success({ query, ...(kinds.length ? { kinds } : {}), ...(limit === undefined ? {} : { limit }) });
}

export function validateMemoryMutationBody(kind, body) {
  if (kind === 'write') {
    if (!exactObject(body, WRITE_FIELDS) || body.explicitUserIntent !== true) {
      return invalid('MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT');
    }
    return success(body);
  }
  if (kind === 'export') {
    if (!exactObject(body, OWNER_FIELDS) || body.explicitUserIntent !== true) {
      return invalid('MEMORY_EXPORT_REQUIRES_EXPLICIT_USER_INTENT');
    }
    return success(body);
  }
  if (kind === 'delete-all') {
    if (!exactObject(body, DELETE_ALL_FIELDS) || body.explicitUserIntent !== true || body.confirmDeleteAll !== true) {
      return invalid('MEMORY_DELETE_ALL_REQUIRES_CONFIRMATION');
    }
    return success(body);
  }
  if (kind === 'delete-one') {
    if (!exactObject(body, DELETE_FIELDS) || body.explicitUserIntent !== true || body.exactMatch !== true) {
      return invalid('MEMORY_DELETE_REQUIRES_EXPLICIT_USER_INTENT');
    }
    return success(body);
  }
  return invalid('INVALID_MEMORY_MUTATION');
}

export function parseMemoryId(pathname) {
  const match = /^\/api\/memory\/(memory_[A-Za-z0-9_-]{8,80})$/.exec(pathname || '');
  if (!match || !MEMORY_ID_PATTERN.test(match[1])) return null;
  return match[1];
}

export function sanitizeMemoryOperationResult(result) {
  if (!result?.ok) return Object.freeze({ status: 400, body: Object.freeze({ error: 'MEMORY_OPERATION_FAILED' }) });
  const body = { ok: true };
  if (Array.isArray(result.records)) body.records = result.records;
  if (result.record) body.record = result.record;
  if (Number.isInteger(result.deleted)) body.deleted = result.deleted;
  return Object.freeze({ status: 200, body: Object.freeze(body) });
}
