import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LOCAL_PROVIDER_SERVER_ENV } from '../lib/local-provider-server-runtime.mjs';

const [runtimeSource, serverSource, toolSource, registrySource] = await Promise.all([
  readFile(new URL('../lib/local-provider-server-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../agents/registry.json', import.meta.url), 'utf8')
]);

assert.deepEqual(Object.keys(LOCAL_PROVIDER_SERVER_ENV).sort(), ['baseUrl', 'enabled']);
assert.deepEqual(Object.values(LOCAL_PROVIDER_SERVER_ENV).sort(), [
  'HAFIZE_LOCAL_PROVIDER_BASE_URL',
  'HAFIZE_LOCAL_PROVIDER_ENABLED'
].sort());

assert.match(runtimeSource, /createLocalOllamaProvider/);
assert.match(runtimeSource, /createModelProviderRouter/);
assert.doesNotMatch(runtimeSource, /API[_-]?KEY|TOKEN|PASSWORD|SECRET|Authorization|Bearer/i);
assert.doesNotMatch(runtimeSource, /child_process|exec\(|spawn\(|shell\s*:/i);
assert.doesNotMatch(runtimeSource, /https:\/\//i);

assert.doesNotMatch(serverSource, /local-provider-server-runtime/);
assert.doesNotMatch(serverSource, /HAFIZE_LOCAL_PROVIDER/);
assert.doesNotMatch(toolSource, /ollama|local_provider/i);
assert.doesNotMatch(registrySource, /ollama|local_provider/i);
assert.match(serverSource, /NVIDIA_API_KEY/);
assert.match(serverSource, /NIM_BASE_URL/);

console.log('local provider server source isolation tests passed');
