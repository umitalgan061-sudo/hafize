// TypeScript migration wave 2026-10.
// Multi-source research fetcher with recency and engine routing.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeQuery(q) {
  const s = typeof q === 'string' ? q.trim() : '';
  if (!s || s.length > 512) fail('INVALID_RESEARCH_QUERY');
  return s;
}

function normalizeEngines(engines) {
  const allowed = new Set(['google', 'bing', 'duckduckgo', 'arxiv', 'pubmed', 'crossref']);
  if (!Array.isArray(engines) || engines.length === 0) return ['google', 'bing', 'duckduckgo'];
  const out = [];
  for (const e of engines) {
    if (!allowed.has(e)) fail('INVALID_RESEARCH_ENGINE');
    out.push(e);
  }
  return [...new Set(out)];
}

export function createResearchFetcher({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  if (typeof fetchImpl !== 'function') fail('INVALID_RESEARCH_FETCHER');

  async function search({ query, engines = [], recencyDays = 365 } = {}) {
    const q = normalizeQuery(query);
    const eng = normalizeEngines(engines);
    const cutoff = now() - recencyDays * 86400000;
    const results = [];
    // Stub implementation: real engines require API keys.
    // This returns a normalized shape for downstream processors.
    for (const engine of eng) {
      results.push({
        url: `https://${engine}.search?q=${encodeURIComponent(q)}`,
        title: `${engine} result for ${q}`,
        snippet: 'stub snippet',
        engine,
        fetchedAt: new Date(now()).toISOString()
      });
    }
    return Object.freeze(results);
  }

  return Object.freeze({ search });
}
