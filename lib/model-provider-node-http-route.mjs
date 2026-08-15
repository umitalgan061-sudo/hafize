const FORBIDDEN_RESPONSE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization'
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireRuntime(runtime) {
  if (!runtime || typeof runtime.handle !== 'function') fail('INVALID_MODEL_PROVIDER_NODE_HTTP:runtime');
  return runtime;
}

function requireWriter(value, label) {
  if (typeof value !== 'function') fail(`INVALID_MODEL_PROVIDER_NODE_HTTP:${label}`);
  return value;
}

function safeHeaderEntries(value) {
  if (value == null) return [];
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_MODEL_PROVIDER_NODE_HTTP_HEADERS');
  const output = [];
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = String(rawName).trim();
    const text = typeof rawValue === 'string' ? rawValue.trim() : '';
    const lower = name.toLowerCase();
    if (
      !name || !text || name.length > 80 || text.length > 500
      || /[\r\n]/.test(name + text)
      || FORBIDDEN_RESPONSE_HEADERS.has(lower)
    ) {
      fail('INVALID_MODEL_PROVIDER_NODE_HTTP_HEADERS');
    }
    output.push([name, text]);
  }
  return output;
}

function applyHeaders(response, headers) {
  if (typeof response?.setHeader !== 'function') fail('INVALID_MODEL_PROVIDER_NODE_HTTP:response');
  for (const [name, value] of safeHeaderEntries(headers)) response.setHeader(name, value);
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

function isAsyncIterable(value) {
  return Boolean(value && typeof value[Symbol.asyncIterator] === 'function');
}

export function createModelProviderNodeHttpRoute({
  runtime,
  sendJson,
  setSecurityHeaders
} = {}) {
  const providerRuntime = requireRuntime(runtime);
  const writeJson = requireWriter(sendJson, 'sendJson');
  const secure = requireWriter(setSecurityHeaders, 'setSecurityHeaders');

  async function handle({ request, response, method, pathname, headers = {} } = {}) {
    if (pathname !== '/api/models' && pathname !== '/api/chat') return Object.freeze({ matched: false });
    if (!response || typeof response.end !== 'function' || typeof response.writeHead !== 'function') {
      fail('INVALID_MODEL_PROVIDER_NODE_HTTP:response');
    }

    const controller = new AbortController();
    const detachAbort = attachAbort(response, controller);
    try {
      const result = await providerRuntime.handle({
        request,
        method,
        pathname,
        headers,
        signal: controller.signal
      });
      if (!result?.matched) return Object.freeze({ matched: false });
      if (controller.signal.aborted) return Object.freeze({ matched: true, aborted: true });

      if (result.kind === 'json') {
        applyHeaders(response, result.headers);
        writeJson(response, result.status, result.body);
        return Object.freeze({ matched: true, kind: 'json', status: result.status });
      }

      if (result.kind !== 'stream' || !isAsyncIterable(result.body)) {
        fail('INVALID_MODEL_PROVIDER_NODE_HTTP_RESPONSE');
      }

      secure(response);
      applyHeaders(response, result.headers);
      response.writeHead(result.status);
      let interrupted = false;
      try {
        for await (const chunk of result.body) {
          if (controller.signal.aborted) break;
          response.write(chunk);
        }
      } catch {
        interrupted = true;
        if (!controller.signal.aborted) {
          response.write(`data: ${JSON.stringify({ error: 'STREAM_INTERRUPTED' })}\n\n`);
        }
      } finally {
        if (!response.writableEnded) response.end();
      }
      return Object.freeze({
        matched: true,
        kind: 'stream',
        status: result.status,
        aborted: controller.signal.aborted,
        interrupted
      });
    } finally {
      detachAbort();
    }
  }

  return Object.freeze({ handle });
}
