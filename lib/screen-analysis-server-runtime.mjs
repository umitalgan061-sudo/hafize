import { createScreenAnalysisHttpApi } from './screen-analysis-http-api.mjs';
import { createScreenAnalysisRuntime } from './screen-analysis-runtime.mjs';

const DEFAULT_MAX_BODY_BYTES = 1536 * 1024;

async function readJsonWithLimit(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function createScreenAnalysisServerRuntime({
  complete,
  configured = true,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES
} = {}) {
  if (typeof complete !== 'function') throw new Error('INVALID_SCREEN_ANALYSIS_SERVER_RUNTIME:complete');
  if (typeof configured !== 'boolean') throw new Error('INVALID_SCREEN_ANALYSIS_SERVER_RUNTIME:configured');
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1024 * 1024 || maxBodyBytes > 2 * 1024 * 1024) {
    throw new Error('INVALID_SCREEN_ANALYSIS_SERVER_RUNTIME:maxBodyBytes');
  }

  const runtime = createScreenAnalysisRuntime({ complete, configured });
  const api = createScreenAnalysisHttpApi({
    runtime,
    readJson: (request) => readJsonWithLimit(request, maxBodyBytes)
  });

  async function handle({ request, method, pathname, signal } = {}) {
    return api.handle({ request, method, pathname, signal });
  }

  return Object.freeze({
    configured,
    maxBodyBytes,
    handle
  });
}

export const SCREEN_ANALYSIS_MAX_BODY_BYTES = DEFAULT_MAX_BODY_BYTES;
