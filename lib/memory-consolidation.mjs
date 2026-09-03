import { PERSONAL_MEMORY_CONTRACT } from './personal-memory-contract.mjs';

const PLAN_FIELDS = new Set(['ownerId', 'records', 'similarityThreshold', 'maxGroups']);
const APPROVAL_FIELDS = new Set(['ownerId', 'plan', 'approvedGroupIds', 'explicitUserIntent']);
const RECORD_FIELDS = new Set([
  'memoryId', 'ownerId', 'kind', 'content', 'sourceType', 'sourceRef',
  'sensitivity', 'createdAt', 'updatedAt'
]);
const MEMORY_ID_PATTERN = /^memory_[a-zA-Z0-9_-]{8,80}$/;
const KINDS = new Set(PERSONAL_MEMORY_CONTRACT.kinds);
const MAX_RECORDS = 512;
const MAX_GROUPS = 50;
const MAX_PREVIEW = 200;
const DEFAULT_SIMILARITY = 0.86;
const MIN_SIMILARITY = 0.6;

function fail(error) {
  return { ok: false, error };
}

function requireExactFields(input, allowed, label) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error(`INVALID_MEMORY_CONSOLIDATION:${label}`);
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`INVALID_MEMORY_CONSOLIDATION:${label}.field`);
  }
}

function cleanText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_MEMORY_CONSOLIDATION:${label}`);
  return text;
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeSearch(value).split(' ').filter(Boolean));
}

function similarity(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}

function toTime(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`INVALID_MEMORY_CONSOLIDATION:${label}`);
  return date.getTime();
}

function preview(content) {
  return content.length > MAX_PREVIEW ? `${content.slice(0, MAX_PREVIEW - 1)}…` : content;
}

function normalizeRecord(raw, ownerId) {
  requireExactFields(raw, RECORD_FIELDS, 'record');
  const memoryId = cleanText(raw.memoryId, 'record.memoryId', 100);
  if (!MEMORY_ID_PATTERN.test(memoryId)) throw new Error('INVALID_MEMORY_CONSOLIDATION:record.memoryId');
  if (cleanText(raw.ownerId, 'record.ownerId', 200) !== ownerId) throw new Error('MEMORY_CONSOLIDATION_OWNER_MISMATCH');
  const kind = cleanText(raw.kind, 'record.kind', 40);
  if (!KINDS.has(kind)) throw new Error('INVALID_MEMORY_CONSOLIDATION:record.kind');
  if (raw.sensitivity !== PERSONAL_MEMORY_CONTRACT.allowedSensitivity) {
    throw new Error('INVALID_MEMORY_CONSOLIDATION:record.sensitivity');
  }
  const content = cleanText(raw.content, 'record.content', PERSONAL_MEMORY_CONTRACT.maxContentLength);
  return {
    memoryId,
    kind,
    content,
    createdAt: toTime(raw.createdAt, 'record.createdAt'),
    tokens: tokenSet(content)
  };
}

function newerFirst(left, right) {
  return right.createdAt - left.createdAt || left.memoryId.localeCompare(right.memoryId);
}

function buildGroups(records, threshold, maxGroups) {
  const remaining = [...records].sort(newerFirst);
  const groups = [];
  while (remaining.length) {
    const keep = remaining.shift();
    const duplicates = [];
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index];
      if (candidate.kind !== keep.kind) continue;
      const score = keep.content === candidate.content ? 1 : similarity(keep.tokens, candidate.tokens);
      if (score < threshold) continue;
      duplicates.unshift({
        memoryId: candidate.memoryId,
        preview: preview(candidate.content),
        similarity: Number(score.toFixed(4))
      });
      remaining.splice(index, 1);
    }
    if (!duplicates.length) continue;
    groups.push({
      groupId: `group_${keep.memoryId}`,
      kind: keep.kind,
      keepMemoryId: keep.memoryId,
      keepPreview: preview(keep.content),
      keepReason: 'newest_owner_statement',
      duplicates
    });
    if (groups.length >= maxGroups) break;
  }
  return groups;
}

export function planMemoryConsolidation(input) {
  try {
    requireExactFields(input === undefined ? {} : input, PLAN_FIELDS, 'input');
    const ownerId = cleanText(input.ownerId, 'ownerId', 200);
    if (!Array.isArray(input.records) || input.records.length > MAX_RECORDS) {
      throw new Error('INVALID_MEMORY_CONSOLIDATION:records');
    }
    const threshold = input.similarityThreshold == null ? DEFAULT_SIMILARITY : input.similarityThreshold;
    if (typeof threshold !== 'number' || !(threshold >= MIN_SIMILARITY) || threshold > 1) {
      throw new Error('INVALID_MEMORY_CONSOLIDATION:similarityThreshold');
    }
    const maxGroups = input.maxGroups == null ? MAX_GROUPS : input.maxGroups;
    if (!Number.isInteger(maxGroups) || maxGroups < 1 || maxGroups > MAX_GROUPS) {
      throw new Error('INVALID_MEMORY_CONSOLIDATION:maxGroups');
    }

    const seen = new Set();
    const records = input.records.map((raw) => {
      const record = normalizeRecord(raw, ownerId);
      if (seen.has(record.memoryId)) throw new Error('INVALID_MEMORY_CONSOLIDATION:records.duplicate');
      seen.add(record.memoryId);
      return record;
    });

    const groups = buildGroups(records, threshold, maxGroups);
    const duplicateCount = groups.reduce((sum, group) => sum + group.duplicates.length, 0);
    return {
      ok: true,
      plan: {
        ownerId,
        similarityThreshold: threshold,
        groups,
        stats: {
          records: records.length,
          groups: groups.length,
          duplicateCandidates: duplicateCount,
          recordsAfterApproval: records.length - duplicateCount
        }
      }
    };
  } catch (error) {
    return fail(error.message);
  }
}

export function normalizeConsolidationApproval(input) {
  try {
    requireExactFields(input === undefined ? {} : input, APPROVAL_FIELDS, 'approval');
    if (input.explicitUserIntent !== true) {
      throw new Error('MEMORY_CONSOLIDATION_REQUIRES_EXPLICIT_USER_INTENT');
    }
    const ownerId = cleanText(input.ownerId, 'ownerId', 200);
    const plan = input.plan;
    if (!plan || Array.isArray(plan) || typeof plan !== 'object' || !Array.isArray(plan.groups)) {
      throw new Error('INVALID_MEMORY_CONSOLIDATION:plan');
    }
    if (plan.ownerId !== ownerId) throw new Error('MEMORY_CONSOLIDATION_OWNER_MISMATCH');
    const ids = input.approvedGroupIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_GROUPS) {
      throw new Error('INVALID_MEMORY_CONSOLIDATION:approvedGroupIds');
    }

    const groupsById = new Map(plan.groups.map((group) => [group?.groupId, group]));
    const approved = new Set();
    const commands = [];
    for (const rawId of ids) {
      const groupId = cleanText(rawId, 'approvedGroupIds', 120);
      if (approved.has(groupId)) throw new Error('INVALID_MEMORY_CONSOLIDATION:approvedGroupIds.duplicate');
      approved.add(groupId);
      const group = groupsById.get(groupId);
      if (!group || !Array.isArray(group.duplicates) || !group.duplicates.length) {
        throw new Error('MEMORY_CONSOLIDATION_UNKNOWN_GROUP');
      }
      for (const duplicate of group.duplicates) {
        const memoryId = cleanText(duplicate?.memoryId, 'duplicate.memoryId', 100);
        if (!MEMORY_ID_PATTERN.test(memoryId)) throw new Error('INVALID_MEMORY_CONSOLIDATION:duplicate.memoryId');
        if (memoryId === group.keepMemoryId) throw new Error('MEMORY_CONSOLIDATION_KEEP_RECORD_PROTECTED');
        commands.push({ ownerId, memoryId, exactMatch: true });
      }
    }
    return { ok: true, commands };
  } catch (error) {
    return fail(error.message);
  }
}

export const MEMORY_CONSOLIDATION_CONTRACT = Object.freeze({
  defaultSimilarityThreshold: DEFAULT_SIMILARITY,
  minSimilarityThreshold: MIN_SIMILARITY,
  maxRecords: MAX_RECORDS,
  maxGroups: MAX_GROUPS,
  previewLength: MAX_PREVIEW,
  requiresExplicitApproval: true
});
