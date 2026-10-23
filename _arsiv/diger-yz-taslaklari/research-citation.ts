// TypeScript migration wave 2026-10.
// Citation generator for research reports.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function generateCitation(doc, style = 'apa') {
  if (!doc || typeof doc !== 'object') fail('INVALID_RESEARCH_DOC');
  const { url, title, accessedAt } = doc;
  if (style === 'apa') {
    return `${title || 'Untitled'}. Retrieved ${accessedAt || new Date().toISOString()}, from ${url || ''}`;
  }
  if (style === 'ieee') {
    return `[1] ${title || 'Untitled'}, ${url || ''}, accessed ${accessedAt || ''}`;
  }
  return `${title || 'Untitled'} - ${url || ''}`;
}

export function buildBibliography(sources, style = 'apa') {
  if (!Array.isArray(sources)) fail('INVALID_RESEARCH_SOURCES');
  return Object.freeze(sources.map((s, i) => ({ id: i + 1, citation: generateCitation(s, style) })));
}
