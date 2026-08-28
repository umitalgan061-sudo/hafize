import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [server, nodeRuntime, tools, registry] = await Promise.all([
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/model-provider-node-server-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../agents/registry.json', import.meta.url), 'utf8')
]);

assert.doesNotMatch(server, /model-provider-http-(?:api|server-runtime)/);
assert.match(server, /createModelProviderNodeServerRuntime/);
assert.match(server, /MODEL_PROVIDER_NODE_SERVER_RUNTIME\.handle/);
assert.match(nodeRuntime, /createModelProviderProductionRuntime/);
assert.match(nodeRuntime, /createModelProviderHttpApi/);
assert.match(nodeRuntime, /createModelProviderNodeHttpRoute/);
assert.match(server, /nvidiaFetch\('\/chat\/completions'/);
assert.doesNotMatch(tools, /local_provider|model_provider/);
assert.doesNotMatch(registry, /local_provider|model_provider/);

console.log('model provider http production isolation tests passed');