// TypeScript migration wave 2026-10.
// Hybrid retrieval for personal memory: dense + sparse + metadata filter.
import { createHash } from 'node:crypto';

const MAX_TOP_K = 200;
const MAX_FILTER_KEYS = 16;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeTopK(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_TOP_K) fail('INVALID_MEMORY_TOP_K');
  return n;
}

function normalizeFilter(filter) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) fail('INVALID_MEMORY_FILTER');
  const keys = Object.keys(filter);
  if (keys.length > MAX_FILTER_KEYS) fail('INVALID_MEMORY_FILTER_KEYS');
  const normalized = {};
  for (const [k, v] of Object.entries(filter)) {
    if (typeof k !== 'string' || k.length > 64) fail('INVALID_MEMORY_FILTER_KEY');
    normalized[k] = v;
  }
  return normalized;
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const inter = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return inter / union;
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

export function createHybridRetriever({ denseWeight = 0.7, sparseWeight = 0.2, metadataWeight = 0.1 } = {}) {
  const wDense = Math.max(0, Math.min(1, denseWeight));
  const wSparse = Math.max(0, Math.min(1, sparseWeight));
  const wMeta = Math.max(0, Math.min(1, metadataWeight));

  function score(item, queryVec, queryTokens, queryFilter) {
    const denseScore = item.vector ? cosine(queryVec, item.vector) : 0;
    const sparseScore = item.tokens ? jaccard(queryTokens, item.tokens) : 0;
    let metaScore = 0;
    if (queryFilter && item.metadata) {
      let matches = 0;
      let total = 0;
      for (const [k, v] of Object.entries(queryFilter)) {
        total++;
        if (item.metadata[k] === v) matches++;
      }
      metaScore = total ? matches / total : 0;
    }
    return wDense * denseScore + wSparse * sparseScore + wMeta * metaScore;
  }

  function query({ items = [], queryVec, queryText, queryFilter = {}, topK = 10, rerank = false } = {}) {
    if (!Array.isArray(items)) fail('INVALID_MEMORY_ITEMS');
    const k = normalizeTopK(topK);
    const filter = normalizeFilter(queryFilter);
    const queryTokens = typeof queryText === 'string' ? queryText.toLowerCase().split(/\W+/).filter(Boolean) : [];

    const scored = items.map(item => ({
      item,
      score: score(item, queryVec, queryTokens, Object.keys(filter).length ? filter : undefined)
    })).filter(x => x.score > 0 || !queryVec && !queryText);

    scored.sort((a, b) => b.score - a.score);

    let results = scored.slice(0, k);
    if (rerank) {
      results = results.map(r => ({
        ...r,
        score: Math.pow(r.score, 1.2)
      })).sort((a, b) => b.score - a.score).slice(0, k);
    }

    return Object.freeze(results.map(r => Object.freeze({
      id: r.item.id,
      score: r.score,
      metadata: r.item.metadata,
      payload: r.item.payload
    })));
  }

  return Object.freeze({ query });
}

export const HYBRID_RETRIEVAL_DEFAULTS = Object.freeze({
  denseWeight: 0.7,
  sparseWeight: 0.2,
  metadataWeight: 0.1
});
