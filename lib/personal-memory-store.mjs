import { randomUUID } from 'node:crypto';
import {
  normalizeMemoryDelete,
  normalizeMemoryRead,
  normalizeMemoryWrite,
  PERSONAL_MEMORY_CONTRACT
} from './personal-memory-contract.mjs';
import {
  MEMORY_RETRIEVAL_LIMIT,
  normalizeMemoryRetrieval
} from './memory-retrieval-boundary.mjs';

const SCHEMA_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 256;
const MAX_ENTRIES = 2048;
const MEMORY_ID_PATTERN = /^memory_[a-zA-Z0-9_-]{8,80}$/;
const SNAPSHOT_FIELDS = new Set(['schemaVersion', 'entries']);
const RECORD_FIELDS = new Set([
  'memoryId', 'ownerId', 'kind', 'content', 'sourceType', 'sourceRef',
  'sensitivity', 'createdAt', 'updatedAt'
]);

function clone(record) {
  return { ...record };
}

function failure(error) {
  return { ok: false, error };
}

function toIso(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`INVALID_MEMORY_STORE:${label}`);
  return date.toISOString();
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreRecord(record, query) {
  const haystack = normalizeSearch(`${record.kind} ${record.content} ${record.sourceRef || ''}`);
  if (haystack.includes(query)) return 100 + query.length;
  const terms = query.split(' ').filter((term) => term.length > 1);
  if (!terms.length || !terms.every((term) => haystack.includes(term))) return 0;
  return terms.length;
}

function validateRestoredRecord(raw) {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') {
    throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:record');
  }
  for (const key of Object.keys(raw)) {
    if (!RECORD_FIELDS.has(key)) throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:field');
  }
  if (typeof raw.memoryId !== 'string' || !MEMORY_ID_PATTERN.test(raw.memoryId)) {
    throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:memoryId');
  }
  const normalized = normalizeMemoryWrite({
    ownerId: raw.ownerId,
    kind: raw.kind,
    content: raw.content,
    sourceType: raw.sourceType,
    sourceRef: raw.sourceRef,
    sensitivity: raw.sensitivity,
    explicitUserIntent: true
  });
  if (!normalized.ok) throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:record');
  return {
    memoryId: raw.memoryId,
    ...normalized.command,
    createdAt: toIso(raw.createdAt, 'createdAt'),
    updatedAt: raw.updatedAt == null ? null : toIso(raw.updatedAt, 'updatedAt')
  };
}

function restoreSnapshot(snapshot, capacity) {
  if (snapshot == null) return [];
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object') {
    throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:input');
  }
  for (const key of Object.keys(snapshot)) {
    if (!SNAPSHOT_FIELDS.has(key)) throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:field');
  }
  if (snapshot.schemaVersion !== SCHEMA_VERSION || !Array.isArray(snapshot.entries)) {
    throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:schema');
  }
  if (snapshot.entries.length > capacity) throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:capacity');

  const ids = new Set();
  return snapshot.entries.map((raw) => {
    const record = validateRestoredRecord(raw);
    if (ids.has(record.memoryId)) throw new Error('INVALID_MEMORY_STORE_SNAPSHOT:duplicate');
    ids.add(record.memoryId);
    return record;
  });
}

export function createPersonalMemoryStore({
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = () => new Date(),
  createId = randomUUID,
  initialSnapshot = null
} = {}) {
  const capacity = Number.isInteger(maxEntries)
    ? Math.min(Math.max(maxEntries, 1), MAX_ENTRIES)
    : DEFAULT_MAX_ENTRIES;
  if (typeof now !== 'function') throw new Error('INVALID_MEMORY_STORE:now');
  if (typeof createId !== 'function') throw new Error('INVALID_MEMORY_STORE:createId');
  const entries = restoreSnapshot(initialSnapshot, capacity);

  function currentIso() {
    return toIso(now(), 'now');
  }

  function nextMemoryId() {
    let suffix;
    try {
      suffix = String(createId()).trim();
    } catch {
      throw new Error('MEMORY_ID_GENERATION_FAILED');
    }
    const memoryId = `memory_${suffix}`;
    if (!MEMORY_ID_PATTERN.test(memoryId)) throw new Error('MEMORY_ID_GENERATION_FAILED');
    if (entries.some((entry) => entry.memoryId === memoryId)) throw new Error('MEMORY_ID_COLLISION');
    return memoryId;
  }

  function snapshot() {
    return { schemaVersion: SCHEMA_VERSION, entries: entries.map(clone) };
  }

  function write(input) {
    const normalized = normalizeMemoryWrite(input);
    if (!normalized.ok) return normalized;
    if (entries.length >= capacity) return failure('MEMORY_STORE_FULL');
    try {
      const record = {
        memoryId: nextMemoryId(),
        ...normalized.command,
        createdAt: currentIso(),
        updatedAt: null
      };
      entries.push(record);
      return { ok: true, record: clone(record) };
    } catch (error) {
      return failure(error.message);
    }
  }

  function read(input) {
    const normalized = normalizeMemoryRead(input);
    if (!normalized.ok) return normalized;
    const { ownerId, query, kinds, limit } = normalized.command;
    const safeQuery = normalizeSearch(query);
    const allowedKinds = kinds.length ? new Set(kinds) : null;
    const records = entries
      .filter((entry) => entry.ownerId === ownerId && (!allowedKinds || allowedKinds.has(entry.kind)))
      .map((entry) => ({ entry, score: scoreRecord(entry, safeQuery) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score
        || b.entry.createdAt.localeCompare(a.entry.createdAt)
        || a.entry.memoryId.localeCompare(b.entry.memoryId))
      .slice(0, limit)
      .map(({ entry }) => clone(entry));
    return { ok: true, records };
  }

  function readForContext(input) {
    const requestedLimit = Number.isInteger(input?.limit)
      ? Math.min(input.limit, MEMORY_RETRIEVAL_LIMIT)
      : MEMORY_RETRIEVAL_LIMIT;
    const result = read({ ...input, limit: requestedLimit });
    if (!result.ok) return result;
    return normalizeMemoryRetrieval({ ownerId: input.ownerId, records: result.records });
  }

  function remove(input) {
    const normalized = normalizeMemoryDelete(input);
    if (!normalized.ok) return normalized;
    const { ownerId, memoryId } = normalized.command;
    const index = entries.findIndex((entry) => entry.ownerId === ownerId && entry.memoryId === memoryId);
    if (index < 0) return failure('MEMORY_NOT_FOUND');
    entries.splice(index, 1);
    return { ok: true, memoryId };
  }

  return Object.freeze({ write, read, readForContext, remove, snapshot });
}

export const PERSONAL_MEMORY_STORE_SCHEMA_VERSION = SCHEMA_VERSION;
export const PERSONAL_MEMORY_STORE_MAX_ENTRIES = MAX_ENTRIES;
export const PERSONAL_MEMORY_STORE_KINDS = PERSONAL_MEMORY_CONTRACT.kinds;
