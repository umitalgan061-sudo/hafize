import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [server, tools, registry] = await Promise.all([
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../agents/registry.json', import.meta.url), 'utf8')
]);

assert.doesNotMatch(server, /local-ollama-provider/);
assert.doesNotMatch(server, /HAFIZE_LOCAL_PROVIDER/);
assert.doesNotMatch(tools, /ollama|local_provider/i);
assert.doesNotMatch(registry, /ollama|local_provider/i);
assert.match(server, /NVIDIA_API_KEY/);
assert.match(server, /NIM_BASE_URL/);

console.log('local provider remains opt-in and production-isolated');
