const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const MAX_MESSAGES = 100;
const MAX_CONTENT = 50000;

function invalid(label) {
  throw new Error(`INVALID_LOCAL_PROVIDER:${label}`);
}

function normalizeBaseUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) invalid('baseUrl');
  let url;
  try { url = new URL(text); } catch { invalid('baseUrl'); }
  if (!['http:', 'https:'].includes(url.protocol)) invalid('baseUrl');
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) invalid('baseUrl');
  if (url.username || url.password || url.search || url.hash) invalid('baseUrl');
  return url.href.replace(/\/+$/, '');
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) invalid('messages');
  return messages.map((message) => {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)) invalid('messages.role');
    if (typeof message.content !== 'string' || !message.content || message.content.length > MAX_CONTENT) {
      invalid('messages.content');
    }
    return { role: message.role, content: message.content };
  });
}

function normalizeRequest(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') invalid('payload');
  const allowed = new Set(['model', 'messages', 'temperature', 'top_p', 'max_tokens']);
  for (const key of Object.keys(payload)) if (!allowed.has(key)) invalid('payload.field');
  const model = typeof payload.model === 'string' ? payload.model.trim() : '';
  if (!MODEL_PATTERN.test(model)) invalid('model');
  const request = { model, messages: normalizeMessages(payload.messages), stream: false };
  if (typeof payload.temperature === 'number') request.options = { temperature: Math.min(Math.max(payload.temperature, 0), 2) };
  if (typeof payload.top_p === 'number') request.options = { ...(request.options || {}), top_p: Math.min(Math.max(payload.top_p, 0), 1) };
  if (Number.isInteger(payload.max_tokens)) {
    request.options = { ...(request.options || {}), num_predict: Math.min(Math.max(payload.max_tokens, 1), 8192) };
  }
  return request;
}

export function createLocalModelProvider({ baseUrl = 'http://127.0.0.1:11434', fetchImpl = globalThis.fetch } = {}) {
  const origin = normalizeBaseUrl(baseUrl);
  if (typeof fetchImpl !== 'function') invalid('fetch');

  async function complete(payload, signal) {
    const body = normalizeRequest(payload);
    let response;
    try {
      response = await fetchImpl(`${origin}/api/chat`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new Error('LOCAL_PROVIDER_UNAVAILABLE');
    }
    const text = await response.text();
    if (!response.ok) throw new Error('LOCAL_PROVIDER_ERROR');
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('INVALID_LOCAL_PROVIDER_RESPONSE'); }
    const content = data?.message?.content;
    if (data?.message?.role !== 'assistant' || typeof content !== 'string') {
      throw new Error('INVALID_LOCAL_PROVIDER_RESPONSE');
    }
    return {
      id: typeof data.created_at === 'string' ? `ollama-${data.created_at}` : 'ollama-local',
      object: 'chat.completion',
      model: typeof data.model === 'string' ? data.model : body.model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: data.done ? 'stop' : null }]
    };
  }

  return Object.freeze({ complete, kind: 'local', baseUrl: origin });
}
