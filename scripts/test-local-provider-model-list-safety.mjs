import assert from 'node:assert/strict';
import { createLocalOllamaProvider, LOCAL_PROVIDER_DEFAULTS } from '../lib/local-ollama-provider.mjs';

function response(payload, { contentType = 'application/json', contentLength } = {}) {
  const text = JSON.stringify(payload);
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        if (key === 'content-type') return contentType;
        if (key === 'content-length') return contentLength == null ? null : String(contentLength);
        return null;
      }
    },
    async text() { return text; }
  };
}

const items = [
  { id: ' llama3.2:3b ' },
  { id: 'llama3.2:3b' },
  { id: 'qwen2.5-coder:7b' },
  { id: 'bad model' },
  { id: '💥' },
  { id: `x${'a'.repeat(160)}` },
  {},
  null
];
for (let index = 0; index < 220; index += 1) items.push({ id: `model-${index}` });

let requestInit;
const provider = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async (_url, init) => {
    requestInit = init;
    return response({ data: items });
  }
});
const models = await provider.listModels();
assert.equal(models[0], 'local:llama3.2:3b');
assert.equal(models[1], 'local:qwen2.5-coder:7b');
assert.equal(models.filter((model) => model === 'local:llama3.2:3b').length, 1);
assert.equal(models.includes('local:bad model'), false);
assert.equal(models.includes('local:💥'), false);
assert.equal(models.length, LOCAL_PROVIDER_DEFAULTS.maxModelCount);
assert.equal(requestInit.method, 'GET');
assert.equal(requestInit.redirect, 'error');
assert.equal(requestInit.headers.Accept, 'application/json');

const wrongType = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async () => response({ data: [{ id: 'secret' }] }, { contentType: 'text/html' })
});
assert.deepEqual(await wrongType.listModels(), []);

const declaredOversize = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async () => response(
    { data: [{ id: 'secret' }] },
    { contentLength: LOCAL_PROVIDER_DEFAULTS.maxModelsJsonBytes + 1 }
  )
});
assert.deepEqual(await declaredOversize.listModels(), []);

const disabled = createLocalOllamaProvider({ enabled: false, fetchImpl: async () => { throw new Error('must not fetch'); } });
assert.deepEqual(await disabled.listModels(), []);

const controller = new AbortController();
const aborting = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  })
});
const pending = aborting.listModels({ signal: controller.signal });
controller.abort();
await assert.rejects(pending, (error) => error?.code === 'LOCAL_PROVIDER_CANCELLED' && error?.status === 499);

console.log('local provider model discovery safety tests passed');
