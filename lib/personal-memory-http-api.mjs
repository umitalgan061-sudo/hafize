import {
  parseMemoryId,
  parseMemoryReadQuery,
  sanitizeMemoryOperationResult,
  validateMemoryMutationBody
} from './personal-memory-http-policy.mjs';

const APPROVAL_PATH = '/api/memory/approval/prepare';
const APPROVAL_HEADER = 'x-hafize-memory-approval';

function invalid(error = 'INVALID_MEMORY_REQUEST') {
  return { status: 400, body: { error } };
}

function cleanRecord(record) {
  if (!record || Array.isArray(record) || typeof record !== 'object') return null;
  const { ownerId: _ownerId, ...publicRecord } = record;
  return publicRecord;
}

function cleanResult(result) {
  const sanitized = sanitizeMemoryOperationResult(result);
  if (sanitized.status !== 200) return sanitized;
  const body = { ...sanitized.body };
  if (Array.isArray(body.records)) body.records = body.records.map(cleanRecord).filter(Boolean);
  if (body.record) body.record = cleanRecord(body.record);
  return { status: 200, body };
}

function validateBody(kind, body) {
  const result = validateMemoryMutationBody(kind, body);
  return result.ok ? null : invalid(result.error);
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? '' : typeof value === 'string' ? value.trim() : '';
}

function approvalError(error) {
  const code = error?.code || error?.message;
  if (code === 'MEMORY_APPROVAL_EXPIRED') return { status: 410, body: { error: code } };
  if (code === 'MEMORY_APPROVAL_REPLAYED') return { status: 409, body: { error: code } };
  if (code === 'MEMORY_APPROVAL_MISMATCH') return { status: 409, body: { error: code } };
  if (code === 'MEMORY_APPROVAL_INVALID') return { status: 403, body: { error: code } };
  return { status: 400, body: { error: 'INVALID_MEMORY_APPROVAL_REQUEST' } };
}

export function createPersonalMemoryHttpApi({ runtime, readJson } = {}) {
  if (!runtime || typeof runtime.authenticate !== 'function' || typeof runtime.authorizeMutation !== 'function') {
    throw new Error('INVALID_MEMORY_HTTP_API:runtime');
  }
  if (runtime.configured !== true) throw new Error('INVALID_MEMORY_HTTP_API:notConfigured');
  if (typeof runtime.approval?.prepare !== 'function' || typeof runtime.approval?.consume !== 'function') {
    throw new Error('INVALID_MEMORY_HTTP_API:approval');
  }
  if (typeof readJson !== 'function') throw new Error('INVALID_MEMORY_HTTP_API:readJson');

  function mutationGuard(headers, ownership) {
    const decision = runtime.authorizeMutation({ headers, ownership });
    if (decision?.ok) return null;
    return {
      status: decision?.error === 'ORIGIN_REQUIRED' ? 403 : 401,
      body: { error: decision?.error === 'ORIGIN_REQUIRED' ? 'ORIGIN_REQUIRED' : 'AUTH_REQUIRED' }
    };
  }

  async function consumeApproval(command, headers, ownerId) {
    const approvalToken = headerValue(headers, APPROVAL_HEADER);
    if (!approvalToken) return { error: { status: 403, body: { error: 'MEMORY_APPROVAL_REQUIRED' } } };
    try {
      const approved = await runtime.approval.consume(command, { ownerId, approvalToken });
      return { approved };
    } catch (error) {
      return { error: approvalError(error) };
    }
  }

  async function handle({ request, method, pathname, url, headers } = {}) {
    if (pathname !== '/api/memory' && !pathname?.startsWith('/api/memory/')) return { matched: false };
    const ownership = runtime.authenticate(headers);
    if (!ownership) return { matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } };
    const ownerId = ownership.ownerId;

    if (method === 'GET' && pathname === '/api/memory') {
      const query = parseMemoryReadQuery(url);
      if (!query.ok) return { matched: true, ...invalid(query.error) };
      return { matched: true, ...cleanResult(runtime.memory.read({ ownerId, ...query.value })) };
    }

    if (method === 'POST' && pathname === APPROVAL_PATH) {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length !== 1 || !body.command) {
        return { matched: true, ...invalid('INVALID_MEMORY_APPROVAL_REQUEST') };
      }
      try {
        const prepared = runtime.approval.prepare(body.command, { ownerId });
        return {
          matched: true,
          status: 200,
          body: { approvalToken: prepared.approvalToken, expiresAt: prepared.expiresAt, command: prepared.command }
        };
      } catch (error) {
        return { matched: true, ...approvalError(error) };
      }
    }

    if (method === 'POST' && pathname === '/api/memory/export') {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      const error = validateBody('export', body);
      if (error) return { matched: true, ...error };
      const command = { kind: 'export', body };
      const approval = await consumeApproval(command, headers, ownerId);
      if (approval.error) return { matched: true, ...approval.error };
      return { matched: true, ...cleanResult(runtime.memory.exportOwner({ ownerId, explicitUserIntent: true })) };
    }

    if (method === 'DELETE' && pathname === '/api/memory') {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      const error = validateBody('delete-all', body);
      if (error) return { matched: true, ...error };
      const command = { kind: 'delete-all', body };
      const approval = await consumeApproval(command, headers, ownerId);
      if (approval.error) return { matched: true, ...approval.error };
      return {
        matched: true,
        ...cleanResult(await runtime.memory.deleteOwner({ ownerId, confirmOwnerId: ownerId, explicitUserIntent: true }))
      };
    }

    if (method === 'POST' && pathname === '/api/memory') {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      const error = validateBody('write', body);
      if (error) return { matched: true, ...error };
      const command = { kind: 'write', body };
      const approval = await consumeApproval(command, headers, ownerId);
      if (approval.error) return { matched: true, ...approval.error };
      return { matched: true, ...cleanResult(await runtime.memory.write({ ownerId, ...body })) };
    }

    const memoryId = parseMemoryId(pathname);
    if (method === 'DELETE' && memoryId) {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      const error = validateBody('delete-one', body);
      if (error) return { matched: true, ...error };
      const command = { kind: 'delete-one', memoryId, body };
      const approval = await consumeApproval(command, headers, ownerId);
      if (approval.error) return { matched: true, ...approval.error };
      return {
        matched: true,
        ...cleanResult(await runtime.memory.remove({ ownerId, memoryId, exactMatch: true }))
      };
    }

    return { matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
  }

  return Object.freeze({ handle });
}

export const PERSONAL_MEMORY_APPROVAL_HTTP = Object.freeze({ path: APPROVAL_PATH, header: APPROVAL_HEADER });
