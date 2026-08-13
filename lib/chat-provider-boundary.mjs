const ALLOWED_FIELDS = new Set(['provider', 'agentMode', 'toolsRequired']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function strictBoolean(value, label) {
  if (value == null) return false;
  if (typeof value !== 'boolean') fail(`INVALID_CHAT_PROVIDER_BOUNDARY:${label}`);
  return value;
}

function normalizeInput(input) {
  if (input == null) return {};
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    fail('INVALID_CHAT_PROVIDER_BOUNDARY:input');
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(key)) fail('INVALID_CHAT_PROVIDER_BOUNDARY:field');
  }
  return input;
}

export function createChatProviderBoundary({ runtime } = {}) {
  if (!runtime || typeof runtime.resolve !== 'function' || typeof runtime.complete !== 'function') {
    fail('INVALID_CHAT_PROVIDER_BOUNDARY:runtime');
  }

  function resolve(input) {
    const value = normalizeInput(input);
    const agentMode = strictBoolean(value.agentMode, 'agentMode');
    const toolsRequired = strictBoolean(value.toolsRequired, 'toolsRequired');
    const provider = runtime.resolve(value.provider, { toolsRequired: toolsRequired || agentMode });
    if (provider === 'local' && agentMode) fail('LOCAL_PROVIDER_AGENT_MODE_UNSUPPORTED');
    return Object.freeze({
      provider,
      agentMode,
      toolsRequired,
      responseMode: provider === 'local' ? 'buffered' : 'stream'
    });
  }

  async function completeLocal({ provider, payload, signal } = {}) {
    if (provider !== 'local') fail('LOCAL_PROVIDER_REQUIRED');
    const result = await runtime.complete({ provider, payload, signal, toolsRequired: false });
    if (result?.provider !== 'local') fail('INVALID_LOCAL_PROVIDER_RESULT');
    return result.result;
  }

  return Object.freeze({ resolve, completeLocal });
}
