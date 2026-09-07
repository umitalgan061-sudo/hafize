const MAX_QUERY_LENGTH = 500;
const TOKEN_PATTERN = /[\p{L}\p{N}_-]+/gu;
const DEFAULT_MIN_TERM_LENGTH = 2;
const DEFAULT_MAX_RESULTS = 5;

function clean(value, max, code) {
  const text = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  if (!text || text.length > max || text.includes('\0')) throw new Error(code);
  return text;
}

function tokenize(value, minLength = DEFAULT_MIN_TERM_LENGTH) {
  return [...new Set((value.match(TOKEN_PATTERN) || []).map((item) => item.toLocaleLowerCase('tr-TR')).filter((item) => item.length >= minLength))];
}

function jaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection || 1);
}

function lexicalScore(queryTokens, record) {
  const haystack = `${record.kind} ${record.content} ${record.sourceRef || ''}`.toLocaleLowerCase('tr-TR');
  if (!queryTokens.length) return 0;
  let hits = 0;
  for (const token of queryTokens) if (haystack.includes(token)) hits += 1;
  return hits / queryTokens.length;
}

function recencyScore(createdAt, nowMs) {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (nowMs - timestamp) / 86_400_000);
  return 1 / (1 + ageDays / 30);
}

export function scoreMemoryRecord(record, query, { now = Date.now(), minTermLength = DEFAULT_MIN_TERM_LENGTH } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('INVALID_MEMORY_QUALITY_RECORD');
  const safeQuery = query == null ? '' : clean(query, MAX_QUERY_LENGTH, 'INVALID_MEMORY_QUALITY_QUERY');
  const queryTokens = tokenize(safeQuery, minTermLength);
  const lexical = lexicalScore(queryTokens, record);
  const kindSignal = queryTokens.includes(String(record.kind || '').toLocaleLowerCase('tr-TR')) ? 0.15 : 0;
  const recency = recencyScore(record.createdAt, now);
  return Object.freeze({ lexical, kindSignal, recency, score: lexical * 0.7 + kindSignal + recency * 0.15 });
}

export function rankMemoryRecords(records, query, { limit = DEFAULT_MAX_RESULTS, now = Date.now(), minTermLength = DEFAULT_MIN_TERM_LENGTH } = {}) {
  if (!Array.isArray(records) || records.length > 2048) throw new Error('INVALID_MEMORY_QUALITY_RECORDS');
  const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), DEFAULT_MAX_RESULTS) : DEFAULT_MAX_RESULTS;
  const scored = records.map((record, index) => ({ record, index, metrics: scoreMemoryRecord(record, query, { now, minTermLength }) }));
  scored.sort((a, b) => b.metrics.score - a.metrics.score
    || b.metrics.recency - a.metrics.recency
    || String(b.record.updatedAt || b.record.createdAt || '').localeCompare(String(a.record.updatedAt || a.record.createdAt || ''))
    || String(a.record.memoryId || '').localeCompare(String(b.record.memoryId || ''))
    || a.index - b.index);
  return Object.freeze(scored.slice(0, safeLimit).map(({ record, metrics }) => Object.freeze({ memoryId: record.memoryId, metrics })));
}

export function measureRetrievalQuality({ expectedIds, ranked, minScore = 0.35 } = {}) {
  if (!Array.isArray(expectedIds) || !Array.isArray(ranked)) throw new Error('INVALID_MEMORY_QUALITY_INPUT');
  const expected = new Set(expectedIds.filter((id) => typeof id === 'string'));
  const results = ranked.filter((item) => item && typeof item.memoryId === 'string');
  const relevant = results.filter((item) => expected.has(item.memoryId));
  const precisionAtK = results.length ? relevant.length / results.length : 0;
  const recallAtK = expected.size ? relevant.length / expected.size : 0;
  const topHit = results[0] && expected.has(results[0].memoryId) ? 1 : 0;
  const thresholdPass = results.every((item) => Number(item.metrics?.score) >= minScore || !expected.has(item.memoryId));
  return Object.freeze({ precisionAtK, recallAtK, topHit, thresholdPass, expected: expected.size, returned: results.length });
}

export const MEMORY_QUALITY_DEFAULTS = Object.freeze({
  maxQueryLength: MAX_QUERY_LENGTH,
  maxResults: DEFAULT_MAX_RESULTS,
  minTermLength: DEFAULT_MIN_TERM_LENGTH,
  lexicalWeight: 0.7,
  recencyWeight: 0.15,
  kindWeight: 0.15
});
