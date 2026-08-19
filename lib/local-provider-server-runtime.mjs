import { createLocalOllamaProvider } from './local-ollama-provider.mjs';
import { createLocalProviderStreamDeadline } from './local-provider-stream-deadline.mjs';
import { createModelProviderRouter } from './model-provider-router.mjs';

const ENABLE_ENV = 'HAFIZE_LOCAL_PROVIDER_ENABLED';
const BASE_URL_ENV = 'HAFIZE_LOCAL_PROVIDER_BASE_URL';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function readEnv(env, name) {
  const value = env?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

function parseEnabled(value) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  fail('INVALID_LOCAL_PROVIDER_ENABLED');
}

function requireFunction(value, label) {
  if (typeof value !== 'function') fail(`INVALID_LOCAL_PROVIDER_SERVER_RUNTIME:${label}`);
  return value;
}

export function createLocalProviderServerRuntime({
  env = process.env,
  nvidiaComplete,
  nvidiaStream,
  nvidiaListModels,
  fetchImpl = globalThis.fetch,
  streamTimeoutMs
} = {}) {
  const completeNvidia = requireFunction(nvidiaComplete, 'nvidiaComplete');
  const streamNvidia = requireFunction(nvidiaStream, 'nvidiaStream');
  const listNvidia = requireFunction(nvidiaListModels, 'nvidiaListModels');
  const enabledValue = readEnv(env, ENABLE_ENV);
  const baseUrl = readEnv(env, BASE_URL_ENV);
  const localEnabled = parseEnabled(enabledValue);

  if (baseUrl && !localEnabled) fail('LOCAL_PROVIDER_BASE_URL_REQUIRES_ENABLE');

  const local = createLocalOllamaProvider({
    enabled: localEnabled,
    ...(baseUrl ? { baseUrl } : {}),
    fetchImpl
  });
  const localStream = createLocalProviderStreamDeadline(local.stream, { timeoutMs: streamTimeoutMs });

  const router = createModelProviderRouter({
    nvidiaComplete: completeNvidia,
    nvidiaStream: streamNvidia,
    nvidiaListModels: listNvidia,
    localComplete: local.complete,
    localStream,
    localListModels: local.listModels,
    localEnabled: local.configured
  });

  return Object.freeze({
    configured: local.configured,
    defaultProvider: router.defaultProvider,
    complete: router.complete,
    stream: router.stream,
    listModels: router.listModels,
    resolve: router.resolve
  });
}

export const LOCAL_PROVIDER_SERVER_ENV = Object.freeze({
  enabled: ENABLE_ENV,
  baseUrl: BASE_URL_ENV
});
