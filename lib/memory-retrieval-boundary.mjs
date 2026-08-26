import { PERSONAL_MEMORY_CONTRACT } from './personal-memory-contract.mjs';

const MAX_RECORDS = 5;
const MEMORY_ID_PATTERN = /^memory_[a-zA-Z0-9_-]{8,80}$/;

function text(value, label, maxLength) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > maxLength) throw new Error(`INVALID_MEMORY_RETRIEVAL:${label}`);
  return result;
}

function normalizeRecord(record, ownerId) {
  if (!record || Array.isArray(record) || typeof record !== 'object') {
    throw new Error('INVALID_MEMORY_RETRIEVAL:record');
  }
  const recordOwner = text(record.ownerId, 'ownerId', 200);
  if (recordOwner !== ownerId) throw new Error('MEMORY_RETRIEVAL_SCOPE_MISMATCH');
  const memoryId = text(record.memoryId, 'memoryId', 100);
  if (!MEMORY_ID_PATTERN.test(memoryId)) throw new Error('INVALID_MEMORY_RETRIEVAL:memoryId');
  const kind = text(record.kind, 'kind', 40);
  const sourceType = text(record.sourceType, 'sourceType', 40);
  if (!PERSONAL_MEMORY_CONTRACT.kinds.includes(kind)) throw new Error('INVALID_MEMORY_RETRIEVAL:kind');
  if (!PERSONAL_MEMORY_CONTRACT.sourceTypes.includes(sourceType)) {
    throw new Error('INVALID_MEMORY_RETRIEVAL:sourceType');
  }
  return {
    memoryId,
    kind,
    content: text(record.content, 'content', PERSONAL_MEMORY_CONTRACT.maxContentLength),
    sourceType,
    sourceRef: record.sourceRef == null ? null : text(record.sourceRef, 'sourceRef', 300)
  };
}

export function normalizeMemoryRetrieval(request) {
  if (request !== undefined && (!request || Array.isArray(request) || typeof request !== 'object')) {
    throw new Error('INVALID_MEMORY_RETRIEVAL:request');
  }
  const { ownerId, records } = request ?? {};
  try {
    const safeOwnerId = text(ownerId, 'ownerId', 200);
    if (!Array.isArray(records) || records.length > MAX_RECORDS) {
      throw new Error('INVALID_MEMORY_RETRIEVAL:records');
    }
    return { ok: true, records: records.map((record) => normalizeRecord(record, safeOwnerId)) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export const MEMORY_RETRIEVAL_LIMIT = MAX_RECORDS;
