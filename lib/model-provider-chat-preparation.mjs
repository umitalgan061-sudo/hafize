import {
  buildAgentSystemMessage,
  createTraceId,
  normalizeClientMessages,
  resolveAgent
} from './agent-runtime.mjs';
import { estimateMessageTokens } from './context-compaction.mjs';

const ALLOWED_FIELDS = new Set([
  'model',
  'messages',
  'agentId',
  'max_tokens',
  'temperature',
  'top_p'
]);
const LOCAL_MODEL_PREFIX = 'local:';

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function requireRegistry(registry) {
  if (!registry || !Array.isArray(registry.agents) || typeof registry.defaultAgent !== 'string') {
    fail('INVALID_MODEL_PROVIDER_CHAT_PREPARER:registry', 500);
  }
  return registry;
}

function requireCompactor(compactor) {
  if (
    !compactor
    || typeof compactor.prepare !== 'function'
    || !Number.isInteger(compactor.thresholdTokens)
    || compactor.thresholdTokens < 1
  ) {
    fail('INVALID_MODEL_PROVIDER_CHAT_PREPARER:contextCompactor', 500);
  }
  return compactor;
}

function boundedInteger(value, fallback, min, max, code) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) fail(code);
  return value;
}

function boundedNumber(value, min, max, code) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(code);
  return value;
}

function validateBody(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') fail('INVALID_CHAT_REQUEST');
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) fail('INVALID_CHAT_REQUEST');
  }
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model || model.length > 240 || /[\u0000-\u001f\u007f]/.test(model)) fail('INVALID_CHAT_REQUEST');
  const messages = normalizeClientMessages(body.messages);
  if (!messages) fail('INVALID_CHAT_REQUEST');
  return { model, messages };
}

function contextHeaders(meta) {
  if (!meta || typeof meta !== 'object') fail('INVALID_CONTEXT_PREPARATION', 500);
  const fields = [meta.beforeTokens, meta.afterTokens];
  if (fields.some((value) => !Number.isInteger(value) || value < 0)) fail('INVALID_CONTEXT_PREPARATION', 500);
  return {
    'X-Hafize-Context-Compacted': meta.compacted ? '1' : '0',
    'X-Hafize-Context-Tokens-Before': String(meta.beforeTokens),
    'X-Hafize-Context-Tokens-After': String(meta.afterTokens)
  };
}

function rejectUnsupportedLocalCompaction(model, messages, compactor) {
  if (!model.startsWith(LOCAL_MODEL_PREFIX)) return;
  if (estimateMessageTokens(messages) <= compactor.thresholdTokens) return;
  if (compactor.supportsLocalModels === true) return;
  fail('LOCAL_CONTEXT_COMPACTION_UNAVAILABLE', 413);
}

export function createModelProviderChatPreparer({
  registry,
  contextCompactor,
  defaultMaxTokens = 2048
} = {}) {
  const agentRegistry = requireRegistry(registry);
  const compactor = requireCompactor(contextCompactor);
  const fallbackMaxTokens = boundedInteger(
    defaultMaxTokens,
    2048,
    1,
    8192,
    'INVALID_MODEL_PROVIDER_CHAT_PREPARER:maxTokens'
  );

  async function prepare(body, { signal = null } = {}) {
    if (signal != null && !(signal instanceof AbortSignal)) fail('INVALID_MODEL_PROVIDER_SIGNAL', 500);
    if (signal?.aborted) fail('MODEL_PROVIDER_CANCELLED', 499);
    const { model, messages } = validateBody(body);
    const agent = resolveAgent(agentRegistry, body.agentId);
    if (!agent) fail('INVALID_AGENT');

    const traceId = createTraceId();
    const conversation = [buildAgentSystemMessage(agent, traceId), ...messages];
    rejectUnsupportedLocalCompaction(model, conversation, compactor);
    const prepared = await compactor.prepare(conversation, { model, signal });
    if (!prepared || !Array.isArray(prepared.messages) || prepared.messages.length === 0) {
      fail('INVALID_CONTEXT_PREPARATION', 500);
    }
    if (signal?.aborted) fail('MODEL_PROVIDER_CANCELLED', 499);

    const payload = {
      model,
      messages: prepared.messages,
      stream: true,
      max_tokens: boundedInteger(body.max_tokens, fallbackMaxTokens, 1, 8192, 'INVALID_CHAT_REQUEST')
    };
    const temperature = boundedNumber(body.temperature, 0, 2, 'INVALID_CHAT_REQUEST');
    const topP = boundedNumber(body.top_p, 0, 1, 'INVALID_CHAT_REQUEST');
    if (temperature != null) payload.temperature = temperature;
    if (topP != null) payload.top_p = topP;

    return Object.freeze({
      payload: Object.freeze(payload),
      headers: Object.freeze({
        'X-Hafize-Trace-Id': traceId,
        ...contextHeaders(prepared.meta)
      })
    });
  }

  return Object.freeze({ prepare });
}
