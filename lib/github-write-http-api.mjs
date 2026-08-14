function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactBody(body, fields) {
  if (!body || Array.isArray(body) || typeof body !== 'object') fail('INVALID_GITHUB_WRITE_HTTP_BODY');
  const keys = Object.keys(body);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) fail('INVALID_GITHUB_WRITE_HTTP_BODY');
  return body;
}

function safeStatus(error) {
  const code = error?.code || error?.message || '';
  if (code === 'AUTH_REQUIRED') return 401;
  if (code.includes('NOT_ALLOWED') || code.includes('AUTH_REQUIRED')) return 403;
  if (code.includes('EXPIRED')) return 410;
  if (code.includes('REPLAYED') || code.includes('MISMATCH')) return 409;
  if (code === 'GITHUB_WRITE_EXECUTION_FAILED') return 502;
  if (code === 'GITHUB_WRITE_CANCELLED') return 499;
  return 400;
}

function safeError(error) {
  const code = typeof error?.code === 'string' ? error.code : typeof error?.message === 'string' ? error.message : '';
  return /^[A-Z0-9_:.-]{3,120}$/.test(code) ? code : 'GITHUB_WRITE_REQUEST_FAILED';
}

export function createGitHubWriteHttpApi({ authenticator, approvalBoundary, executionBoundary, readJson } = {}) {
  if (typeof authenticator?.authenticate !== 'function') fail('INVALID_GITHUB_WRITE_HTTP_AUTHENTICATOR');
  if (typeof approvalBoundary?.prepare !== 'function') fail('INVALID_GITHUB_WRITE_HTTP_APPROVAL');
  if (typeof executionBoundary?.execute !== 'function') fail('INVALID_GITHUB_WRITE_HTTP_EXECUTION');
  if (typeof readJson !== 'function') fail('INVALID_GITHUB_WRITE_HTTP_READ_JSON');

  async function handle({ request, method, pathname, headers, signal } = {}) {
    if (pathname !== '/api/github/write/prepare' && pathname !== '/api/github/write/execute') return { matched: false };
    if (method !== 'POST') return { matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
    const auth = authenticator.authenticate({ headers });
    if (!auth?.ok) return { matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } };

    try {
      const body = await readJson(request);
      if (pathname.endsWith('/prepare')) {
        exactBody(body, ['command']);
        const prepared = approvalBoundary.prepare(body.command, { principal: auth.principal });
        return {
          matched: true,
          status: 200,
          body: { approvalToken: prepared.approvalToken, expiresAt: prepared.expiresAt, command: prepared.command }
        };
      }
      exactBody(body, ['command', 'approvalToken']);
      const receipt = await executionBoundary.execute(body.command, {
        principal: auth.principal,
        approvalToken: body.approvalToken,
        signal
      });
      return { matched: true, status: 200, body: { receipt } };
    } catch (error) {
      return { matched: true, status: safeStatus(error), body: { error: safeError(error) } };
    }
  }

  return Object.freeze({ handle });
}
