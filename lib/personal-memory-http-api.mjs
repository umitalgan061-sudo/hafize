import { normalizeMemoryWrite } from './personal-memory-contract.mjs';
import {
  parseMemoryId,
  parseMemoryReadQuery,
  sanitizeMemoryOperationResult,
  validateMemoryMutationBody
} from './personal-memory-http-policy.mjs';

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

function normalizeApprovedWrite(ownerId, body) {
  const normalized = normalizeMemoryWrite({
    ownerId,
    kind: body?.kind,
    content: body?.content,
    sourceType: body?.sourceType,
    ...(body?.sourceRef === undefined ? {} : { sourceRef: body.sourceRef }),
    sensitivity: body?.sensitivity,
    explicitUserIntent: true
  });
  return normalized.ok ? normalized.command : null;
}

function approvalDenied() {
  return { status: 403, body: { error: 'MEMORY_WRITE_APPROVAL_INVALID' } };
}

export function createPersonalMemoryHttpApi({ runtime, readJson } = {}) {
  if (!runtime || typeof runtime.authenticate !== 'function' || typeof runtime.authorizeMutation !== 'function') {
    throw new Error('INVALID_MEMORY_HTTP_API:runtime');
  }
  if (runtime.configured !== true) throw new Error('INVALID_MEMORY_HTTP_API:notConfigured');
  if (!runtime.writeApproval || typeof runtime.writeApproval.issue !== 'function' || typeof runtime.writeApproval.consume !== 'function') {
    throw new Error('INVALID_MEMORY_HTTP_API:writeApproval');
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

    if (method === 'POST' && pathname === '/api/memory/approval') {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      const error = validateBody('write-approval', body);
      if (error) return { matched: true, ...error };
      const command = normalizeApprovedWrite(ownerId, body);
      if (!command) return { matched: true, ...invalid('INVALID_MEMORY_WRITE') };
      try {
        return { matched: true, status: 200, body: { ok: true, ...runtime.writeApproval.issue(command) } };
      } catch {
        return { matched: true, ...approvalDenied() };
      }
    }

    if (method === 'POST' && pathname === '/api/memory/export') {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      const error = validateBody('export', body);
      if (error) return { matched: true, ...error };
      return { matched: true, ...cleanResult(runtime.memory.exportOwner({ ownerId, explicitUserIntent: true })) };
    }

    if (method === 'DELETE' && pathname === '/api/memory') {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      const error = validateBody('delete-all', body);
      if (error) return { matched: true, ...error };
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
      const command = normalizeApprovedWrite(ownerId, body);
      if (!command) return { matched: true, ...invalid('INVALID_MEMORY_WRITE') };
      try {
        runtime.writeApproval.consume({ approvalReceipt: body.approvalReceipt, payload: command });
      } catch {
        return { matched: true, ...approvalDenied() };
      }
      return {
        matched: true,
        ...cleanResult(await runtime.memory.write({ ...command, explicitUserIntent: true }))
      };
    }

    const memoryId = parseMemoryId(pathname);
    if (method === 'DELETE' && memoryId) {
      const denied = mutationGuard(headers, ownership);
      if (denied) return { matched: true, ...denied };
      const body = await readJson(request);
      const error = validateBody('delete-one', body);
      if (error) return { matched: true, ...error };
      return {
        matched: true,
        ...cleanResult(await runtime.memory.remove({ ownerId, memoryId, exactMatch: true }))
      };
    }

    return { matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
  }

  return Object.freeze({ handle });
}
