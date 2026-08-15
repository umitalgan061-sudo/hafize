function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireRuntime(runtime) {
  if (!runtime || typeof runtime.handle !== 'function') fail('INVALID_GITHUB_WRITE_NODE_HTTP:runtime');
  return runtime;
}

function requireWriter(value) {
  if (typeof value !== 'function') fail('INVALID_GITHUB_WRITE_NODE_HTTP:sendJson');
  return value;
}

function isWritePath(pathname) {
  return pathname === '/api/github/write/prepare' || pathname === '/api/github/write/execute';
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

export function createGitHubWriteNodeHttpRoute({ runtime, sendJson } = {}) {
  const writeRuntime = requireRuntime(runtime);
  const writeJson = requireWriter(sendJson);

  async function handle({ request, response, method, pathname, headers = {} } = {}) {
    if (!isWritePath(pathname)) return Object.freeze({ matched: false });
    if (!response || typeof response.end !== 'function') fail('INVALID_GITHUB_WRITE_NODE_HTTP:response');

    const controller = new AbortController();
    const detachAbort = attachAbort(response, controller);
    try {
      const result = await writeRuntime.handle({
        request,
        method,
        pathname,
        headers,
        signal: controller.signal
      });
      if (!result?.matched) return Object.freeze({ matched: false });
      if (controller.signal.aborted || response.writableEnded || response.destroyed) {
        return Object.freeze({ matched: true, aborted: true });
      }
      if (!validResult(result)) fail('INVALID_GITHUB_WRITE_NODE_HTTP_RESPONSE');
      writeJson(response, result.status, result.body);
      return Object.freeze({ matched: true, status: result.status });
    } finally {
      detachAbort();
    }
  }

  return Object.freeze({ handle });
}
