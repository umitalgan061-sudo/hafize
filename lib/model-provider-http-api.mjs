function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireProvider(provider) {
  if (!provider || typeof provider.listModels !== 'function' || typeof provider.stream !== 'function') {
    fail('INVALID_MODEL_PROVIDER_HTTP_API:provider');
  }
  return provider;
}

function requireReadJson(readJson) {
  if (typeof readJson !== 'function') fail('INVALID_MODEL_PROVIDER_HTTP_API:readJson');
  return readJson;
}

function requirePrepareChat(prepareChat) {
  if (typeof prepareChat !== 'function') fail('INVALID_MODEL_PROVIDER_HTTP_API:prepareChat');
  return prepareChat;
}

function safeHeaders(value) {
  if (value == null) return {};
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_MODEL_PROVIDER_HTTP_HEADERS');
  const headers = {};
  for (const [name, raw] of Object.entries(value)) {
    const key = String(name).trim();
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!key || !text || key.length > 80 || text.length > 500 || /[\r\n]/.test(key + text)) {
      fail('INVALID_MODEL_PROVIDER_HTTP_HEADERS');
    }
    const lower = key.toLowerCase();
    if (['authorization', 'cookie', 'set-cookie', 'proxy-authorization'].includes(lower)) {
      fail('INVALID_MODEL_PROVIDER_HTTP_HEADERS');
    }
    headers[key] = text;
  }
  return Object.freeze(headers);
}

function validatePrepared(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_MODEL_PROVIDER_CHAT_PREPARATION');
  const allowed = new Set(['payload', 'headers']);
  if (Object.keys(value).some((key) => !allowed.has(key))) fail('INVALID_MODEL_PROVIDER_CHAT_PREPARATION');
  const payload = value.payload;
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('INVALID_MODEL_PROVIDER_CHAT_PREPARATION');
  if (typeof payload.model !== 'string' || !payload.model.trim() || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    fail('INVALID_MODEL_PROVIDER_CHAT_PREPARATION');
  }
  if (payload.stream !== true) fail('INVALID_MODEL_PROVIDER_CHAT_PREPARATION');
  if ('tools' in payload || 'tool_choice' in payload) fail('MODEL_PROVIDER_HTTP_TOOLS_NOT_ALLOWED');
  return { payload, headers: safeHeaders(value.headers) };
}

function errorResponse(result) {
  return Object.freeze({
    matched: true,
    status: Number.isInteger(result?.status) ? result.status : 502,
    kind: 'json',
    body: { error: typeof result?.error === 'string' ? result.error : 'MODEL_PROVIDER_FAILED' },
    headers: Object.freeze({ 'Cache-Control': 'no-store' })
  });
}

function preparationFailure(error, signal) {
  if (signal?.aborted || error?.name === 'AbortError' || error?.code === 'MODEL_PROVIDER_CANCELLED') {
    return errorResponse({ status: 499, error: 'MODEL_PROVIDER_CANCELLED' });
  }
  if (error instanceof SyntaxError) return errorResponse({ status: 400, error: 'INVALID_JSON' });
  const code = typeof error?.code === 'string' ? error.code : typeof error?.message === 'string' ? error.message : '';
  if (code === 'BODY_TOO_LARGE') return errorResponse({ status: 413, error: 'BODY_TOO_LARGE' });
  if (code === 'INVALID_CHAT_REQUEST' || code === 'INVALID_AGENT') return errorResponse({ status: 400, error: code });
  return errorResponse({ status: 500, error: 'CHAT_PREPARATION_FAILED' });
}

export function createModelProviderHttpApi({ provider, readJson, prepareChat } = {}) {
  const runtime = requireProvider(provider);
  const readBody = requireReadJson(readJson);
  const prepare = requirePrepareChat(prepareChat);

  async function handle({ request, method, pathname, headers = {}, signal = null } = {}) {
    if (pathname !== '/api/models' && pathname !== '/api/chat') return Object.freeze({ matched: false });

    if (pathname === '/api/models') {
      if (method !== 'GET') return errorResponse({ status: 405, error: 'METHOD_NOT_ALLOWED' });
      const result = await runtime.listModels({ signal });
      if (!result?.ok) return errorResponse(result);
      return Object.freeze({
        matched: true,
        status: 200,
        kind: 'json',
        body: result.value,
        headers: Object.freeze({ 'Cache-Control': 'no-store' })
      });
    }

    if (method !== 'POST') return errorResponse({ status: 405, error: 'METHOD_NOT_ALLOWED' });
    let prepared;
    try {
      const body = await readBody(request);
      prepared = validatePrepared(await prepare(body, { headers, signal }));
    } catch (error) {
      return preparationFailure(error, signal);
    }
    const result = await runtime.stream(prepared.payload, { signal, toolsRequired: false });
    if (!result?.ok) return errorResponse(result);
    return Object.freeze({
      matched: true,
      status: 200,
      kind: 'stream',
      provider: result.value.provider,
      body: result.value.body,
      headers: Object.freeze({
        ...prepared.headers,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform'
      })
    });
  }

  return Object.freeze({ handle });
}
