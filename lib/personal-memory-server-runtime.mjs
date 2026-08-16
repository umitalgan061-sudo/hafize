import { createPersonalMemoryControlRuntime } from './personal-memory-control-runtime.mjs';
import { createPersonalMemoryHttpApi } from './personal-memory-http-api.mjs';

function fail(field) {
  throw new Error(`INVALID_MEMORY_SERVER_RUNTIME:${field}`);
}

export async function createPersonalMemoryServerRuntime({
  env = process.env,
  readJson,
  createControlRuntime = createPersonalMemoryControlRuntime,
  createHttpApi = createPersonalMemoryHttpApi
} = {}) {
  if (typeof readJson !== 'function') fail('readJson');
  if (typeof createControlRuntime !== 'function') fail('createControlRuntime');
  if (typeof createHttpApi !== 'function') fail('createHttpApi');

  const runtime = await createControlRuntime({ env });
  if (!runtime || typeof runtime !== 'object') fail('runtime');
  if (runtime.configured !== true) {
    return Object.freeze({
      configured: false,
      async handle() {
        return { matched: false };
      }
    });
  }

  const api = createHttpApi({ runtime, readJson });
  if (!api || typeof api.handle !== 'function') fail('api');

  return Object.freeze({
    configured: true,
    handle(input) {
      return api.handle(input);
    }
  });
}
