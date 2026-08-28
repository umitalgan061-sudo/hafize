import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [runtime, server, registry, tools] = await Promise.all([
  readFile(new URL('../lib/model-provider-node-server-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'),
  readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8')
]);

assert.match(runtime, /createModelProviderProductionRuntime/);
assert.match(runtime, /createModelProviderContextCompactor/);
assert.match(runtime, /createModelProviderChatPreparer/);
assert.match(runtime, /createModelProviderHttpApi/);
assert.match(runtime, /createModelProviderNodeHttpRoute/);
assert.match(runtime, /complete: provider\.complete/);
assert.match(runtime, /supportsLocalModels !== true/);

assert.doesNotMatch(runtime, /child_process|\bexec(?:File)?\s*\(|\bspawn\s*\(|shell\s*:\s*true/i);
assert.doesNotMatch(runtime, /localStorage|sessionStorage|indexedDB/i);
assert.doesNotMatch(runtime, /NVIDIA_API_KEY|Authorization\s*:/);
assert.doesNotMatch(runtime, /repo\.write_branch|repo\.merge|external\.send|external\.write/);

assert.match(server, /createModelProviderNodeServerRuntime/);
assert.match(server, /MODEL_PROVIDER_NODE_SERVER_RUNTIME\.handle/);
assert.doesNotMatch(server, /createLocalOllamaProvider|createLocalProviderServerRuntime|local-ollama-provider|local-provider-server-runtime/);
assert.doesNotMatch(tools, /local_provider|ollama|model_provider/i);
assert.doesNotMatch(registry, /local_provider|ollama|model_provider/i);

console.log('model provider node server source isolation tests passed');