const START_PATH = '/api/connectors/gmail/oauth/start';
const CALLBACK_PATH = '/api/connectors/gmail/oauth/callback';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireRuntime(runtime) {
  if (!runtime || typeof runtime.handle !== 'function') fail('INVALID_GOOGLE_OAUTH_NODE_HTTP:runtime');
  return runtime;
}

function requireWriter(value) {
  if (typeof value !== 'function') fail('INVALID_GOOGLE_OAUTH_NODE_HTTP:sendJson');
  return value;
}

function isOAuthPath(pathname) {
  return pathname === START_PATH || pathname === CALLBACK_PATH;
}

function narrowHeaders(pathname, headers) {
  if (pathname !== START_PATH || !headers || typeof headers !== 'object') return Object.freeze({});
  const authorization = headers.authorization ?? headers.Authorization;
  return typeof authorization === 'string'
    ? Object.freeze({ authorization })
    : Object.freeze({});
}

function validResult(result) {
  if (!result || result.matched !== true) return false;
  if (!Number.isInteger(result.status) || result.status < 100 || result.status > 599) return false;
  if (!result.body || Array.isArray(result.body) || typeof result.body !== 'object') return false;
  return true;
}

function attachAbort(response, controller) {
  if (typeof response?.once !== 'function') return () => {};
  const onClose = () => controller.abort();
  response.once('close', onClose);
  return () => {
    if (typeof response.off === 'function') response.off('close', onClose);
    else if (typeof response.removeListener === 'function') response.removeListener('close', onClose);
  };
}

function requireCallbackUrl(pathname, url) {
  if (pathname !== CALLBACK_PATH) return;
  if (!url?.searchParams || typeof url.searchParams.getAll !== 'function') {
    fail('INVALID_GOOGLE_OAUTH_NODE_HTTP:url');
  }
}

export function createGoogleOAuthNodeHttpRoute({ runtime, sendJson } = {}) {
  const oauthRuntime = requireRuntime(runtime);
  const writeJson = requireWriter(sendJson);

  async function handle({ response, method, pathname, url, headers = {} } = {}) {
    if (!isOAuthPath(pathname)) return Object.freeze({ matched: false });
    if (!response || typeof response.end !== 'function') fail('INVALID_GOOGLE_OAUTH_NODE_HTTP:response');
    requireCallbackUrl(pathname, url);

    if (response.writableEnded || response.destroyed) {
      return Object.freeze({ matched: true, aborted: true });
    }

    const controller = new AbortController();
    const detachAbort = attachAbort(response, controller);
    try {
      const result = await oauthRuntime.handle({
        method,
        pathname,
        url,
        headers: narrowHeaders(pathname, headers),
        signal: controller.signal
      });
      if (!result?.matched) return Object.freeze({ matched: false });
      if (controller.signal.aborted || response.writableEnded || response.destroyed) {
        return Object.freeze({ matched: true, aborted: true });
      }
      if (!validResult(result)) fail('INVALID_GOOGLE_OAUTH_NODE_HTTP_RESPONSE');
      writeJson(response, result.status, result.body);
      return Object.freeze({ matched: true, status: result.status });
    } finally {
      detachAbort();
    }
  }

  return Object.freeze({ handle });
}

export const GOOGLE_OAUTH_NODE_HTTP_PATHS = Object.freeze({
  start: START_PATH,
  callback: CALLBACK_PATH
});
