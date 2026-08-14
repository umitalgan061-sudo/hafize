export function createScreenAnalysisHttpApi({ runtime, readJson } = {}) {
  if (!runtime || typeof runtime.analyze !== 'function') throw new Error('INVALID_SCREEN_ANALYSIS_HTTP_API:runtime');
  if (typeof readJson !== 'function') throw new Error('INVALID_SCREEN_ANALYSIS_HTTP_API:readJson');

  async function handle({ request, method, pathname, signal } = {}) {
    if (pathname !== '/api/screen-analysis') return { matched: false };
    if (method !== 'POST') {
      return {
        matched: true,
        status: 405,
        headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
        body: { error: 'METHOD_NOT_ALLOWED' }
      };
    }

    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      if (error?.message === 'BODY_TOO_LARGE') {
        return { matched: true, status: 413, headers: { 'Cache-Control': 'no-store' }, body: { error: 'BODY_TOO_LARGE' } };
      }
      if (error instanceof SyntaxError) {
        return { matched: true, status: 400, headers: { 'Cache-Control': 'no-store' }, body: { error: 'INVALID_JSON' } };
      }
      return { matched: true, status: 400, headers: { 'Cache-Control': 'no-store' }, body: { error: 'INVALID_SCREEN_ANALYSIS_REQUEST' } };
    }

    const result = await runtime.analyze(body, { signal });
    if (!result.ok) {
      const response = { error: result.error };
      if (typeof result.reason === 'string') response.reason = result.reason;
      return { matched: true, status: result.status, headers: { 'Cache-Control': 'no-store' }, body: response };
    }

    return {
      matched: true,
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      body: { content: result.value.content, model: result.value.model }
    };
  }

  return Object.freeze({ handle });
}
