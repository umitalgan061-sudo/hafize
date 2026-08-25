import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/local-ollama-provider.mjs', import.meta.url), 'utf8');
const production = await readFile(new URL('../lib/model-provider-production-runtime.mjs', import.meta.url), 'utf8');
const serverRuntime = await readFile(new URL('../lib/local-provider-server-runtime.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

for (const required of [
  "['localhost', '127.0.0.1', '::1']",
  "redirect: 'error'",
  "requireMediaType(response, 'application/json')",
  "requireMediaType(response, 'text/event-stream')",
  'assertNoLocalToolRequest(input)',
  'LOCAL_PROVIDER_TOOLS_UNSUPPORTED',
  'MAX_COMPLETION_JSON_BYTES',
  'MAX_MODELS_JSON_BYTES',
  'MAX_STREAM_BYTES',
  'MAX_STREAM_CHUNK_BYTES',
  'LOCAL_PROVIDER_TIMEOUT',
  'LOCAL_PROVIDER_CANCELLED'
]) assert.equal(source.includes(required), true, `missing local-provider guard: ${required}`);

for (const forbidden of [
  'child_process',
  'exec(',
  'spawn(',
  'shell: true',
  'shell=True',
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'Authorization:',
  'Bearer '
]) assert.equal(source.includes(forbidden), false, `forbidden local-provider surface: ${forbidden}`);

assert.match(production, /defaultProvider\s*=\s*'nvidia'/);
assert.match(production, /isLocalProviderModel\(model\)/);
assert.match(serverRuntime, /HAFIZE_LOCAL_PROVIDER_ENABLED/);
assert.match(serverRuntime, /HAFIZE_LOCAL_PROVIDER_BASE_URL/);

assert.equal(registry.defaultAgent, 'minimal-engineer');
assert.equal(registry.policy?.topology, 'hierarchical');
assert.equal(registry.policy?.externalWritesRequireApproval, true);
assert.equal(registry.policy?.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy?.sharedTraceIdRequired, true);
assert.equal(registry.agents.length, 4);
for (const agent of registry.agents) {
  assert.equal(agent?.toolPolicy?.default, 'deny', `${agent?.id || 'unknown'} must remain default-deny`);
  assert.equal(Array.isArray(agent?.toolPolicy?.allow), true);
  assert.equal(Array.isArray(agent?.toolPolicy?.deny), true);
}

console.log('local provider security contract tests passed: loopback-only local runtime, tool denial, NVIDIA default, and canonical default-deny registry verified');
