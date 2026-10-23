// TypeScript migration wave 2026-10.
// Content extractor stub: main text, structured data, tables, paywall detection.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createResearchExtractor({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') fail('INVALID_RESEARCH_EXTRACTOR');

  async function read(url) {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) fail('INVALID_RESEARCH_URL');
    // Stub: real implementation would fetch and run Readability/Trafilatura.
    return Object.freeze({
      url,
      mainText: '',
      structuredData: null,
      tables: [],
      images: [],
      paywall: false,
      fetchedAt: new Date().toISOString()
    });
  }

  return Object.freeze({ read });
}
