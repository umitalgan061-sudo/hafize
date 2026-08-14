const DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1';
const MODEL_PREFIX = 'local:';
const MAX_MODEL_LENGTH = 160;
const ALLOWED_FIELDS = new Set([
  'model', 'messages', 'stream', 'max_tokens', 'temperature', 'top_p', 'tools', 'tool_choice'
]);

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function normalizeEnabled(value) {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || DEFAULT_BASE_URL));
  } catch {
    fail('INVALID_LOCAL_PROVIDER_BASE_URL');
  }
  if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) {
    fail('INVALID_LOCAL_PROVIDER_BASE_URL');
  }
  const host = url.hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) fail('LOCAL_PROVIDER_MUST_BE_LOOPBACK');
  return url.toString().replace(/\/+$/, '');
}

function normalizeModel(value) {
  const model = typeof value === 'string' ? value.trim() : '';
  if (!model.startsWith(MODEL_PREFIX)) fail('LOCAL_PROVIDER_MODEL_PREFIX_REQUIRED');
  const localModel = model.slice(MODEL_PREFIX.length).trim();
  if (!localModel || localModel.length > MAX_MODEL_LENGTH || /[\u0000-\u001f\u007f]/.test(localModel)) {
    fail('INVALID_LOCAL_PROVIDER_MODEL');
  }
  return localModel;
}

function normalizePayload(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_LOCAL_PROVIDER_REQUEST');
  if (Object.keys(input).some((key) => !ALLOWED_FIELDS.has(key))) fail('INVALID_LOCAL_PROVIDER_FIELD');
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 200) {
    fail('INVALID_LOCAL_PROVIDER_MESSAGES');
  }
  const messages = input.messages.map((message) => {
    if (!message || Array.isArray(message) || typeof message !== 'object') fail('INVALID_LOCAL_PROVIDER_MESSAGES');
    if (!['system', 'user', 'assistant', 'tool'].includes(message.role) || typeof message.content !== 'string') {
      fail('INVALID_LOCAL_PROVIDER_MESSAGES');
    }
    if (message.content.length > 100_000) fail('INVALID_LOCAL_PROVIDER_MESSAGES');
    const normalized = { role: message.role, content: message.content };
    if (message.role === 'tool') {
      if (typeof message.tool_call_id !== 'string' || !message.tool_call_id.trim()) fail('INVALID_LOCAL_PROVIDER_MESSAGES');
      normalized.tool_call_id = message.tool_call_id.trim();
    }
    return normalized;
  });
  const payload = {
    model: normalizeModel(input.model),
    messages,
    stream: input.stream === true
  };
  if (Number.isInteger(input.max_tokens)) payload.max_tokens = Math.min(Math.max(input.max_tokens, 1), 32_768);
  if (typeof input.temperature === 'number' && Number.isFinite(input.temperature)) {
    payload.temperature = Math.min(Math.max(input.temperature, 0), 2);
  }
  if (typeof input.top_p === 'number' && Number.isFinite(input.top_p)) payload.top_p = Math.min(Math.max(input.top_p, 0), 1);
  if (Array.isArray(input.tools) && input.tools.length) payload.tools = input.tools;
  if (input.tool_choice === 'auto' || input.tool_choice === 'none') payload.tool_choice = input.tool_choice;
  return payload;
}

function sanitizeJsonResponse(payload) {
  const message = payload?.choices?.[0]?.message;
  if (!message || message.role !== 'assistant') fail('INVALID_LOCAL_PROVIDER_RESPONSE', 502);
  return payload;
}

async function request(fetchImpl, apiBase, payload, signal, accept) {
  let response;
  try {
    response = await fetchImpl(`${apiBase}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Accept: accept },
      body: JSON.stringify(payload)
    });
  } catch {
    if (signal?.aborted) fail('LOCAL_PROVIDER_CANCELLED', 499);
    fail('LOCAL_PROVIDER_UNAVAILABLE', 502);
  }
  if (!response?.ok) fail('LOCAL_PROVIDER_FAILED', Number.isInteger(response?.status) ? response.status : 502);
  return response;
}

export function isLocalProviderModel(model) {
  return typeof model === 'string' && model.trim().startsWith(MODEL_PREFIX);
}

export function createLocalOllamaProvider({
  enabled = false,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  const configured = normalizeEnabled(enabled);
  const apiBase = normalizeBaseUrl(baseUrl);
  if (typeof fetchImpl !== 'function') fail('LOCAL_PROVIDER_FETCH_UNAVAILABLE', 503);

  async function complete(input, { signal } = {}) {
    if (!configured) fail('LOCAL_PROVIDER_NOT_ENABLED', 503);
    const payload = normalizePayload({ ...input, stream: false });
    const response = await request(fetchImpl, apiBase, payload, signal, 'application/json');
    let data;
    try {
      data = await response.json();
    } catch {
      fail('INVALID_LOCAL_PROVIDER_RESPONSE', 502);
    }
    return sanitizeJsonResponse(data);
  }

  async function stream(input, { signal } = {}) {
    if (!configured) fail('LOCAL_PROVIDER_NOT_ENABLED', 503);
    const payload = normalizePayload({ ...input, stream: true });
    const response = await request(fetchImpl, apiBase, payload, signal, 'text/event-stream');
    if (!response.body || typeof response.body[Symbol.asyncIterator] !== 'function') {
      fail('INVALID_LOCAL_PROVIDER_STREAM', 502);
    }
    return response.body;
  }

  async function listModels({ signal } = {}) {
    if (!configured) return [];
    let response;
    try {
      response = await fetchImpl(`${apiBase}/models`, { signal, headers: { Accept: 'application/json' } });
    } catch {
      return [];
    }
    if (!response?.ok) return [];
    let data;
    try {
      data = await response.json();
    } catch {
      return [];
    }
    const items = Array.isArray(data?.data) ? data.data : [];
    return items
      .map((item) => typeof item?.id === 'string' ? item.id.trim() : '')
      .filter(Boolean)
      .slice(0, 200)
      .map((id) => `${MODEL_PREFIX}${id}`);
  }

  return Object.freeze({ configured, complete, stream, listModels });
}

export const LOCAL_PROVIDER_DEFAULTS = Object.freeze({
  baseUrl: DEFAULT_BASE_URL,
  modelPrefix: MODEL_PREFIX
});
