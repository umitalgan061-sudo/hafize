import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LOCAL_PROVIDER_DEFAULTS } from '../lib/local-ollama-provider.mjs';
import { MODEL_PROVIDER_PRODUCTION_DEFAULTS } from '../lib/model-provider-production-runtime.mjs';

assert.equal(LOCAL_PROVIDER_DEFAULTS.maxCompletionJsonBytes, MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxCompletionJsonBytes);
assert.equal(LOCAL_PROVIDER_DEFAULTS.maxModelsJsonBytes, MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelsJsonBytes);
assert.equal(LOCAL_PROVIDER_DEFAULTS.maxStreamBytes, MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxStreamBytes);
assert.equal(LOCAL_PROVIDER_DEFAULTS.maxStreamChunkBytes, MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxStreamChunkBytes);
assert.equal(LOCAL_PROVIDER_DEFAULTS.jsonTimeoutMs, MODEL_PROVIDER_PRODUCTION_DEFAULTS.jsonTimeoutMs);
assert.equal(LOCAL_PROVIDER_DEFAULTS.maxJsonTimeoutMs, MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxJsonTimeoutMs);

const router = await readFile(new URL('../lib/model-provider-router.mjs', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../lib/local-provider-server-runtime.mjs', import.meta.url), 'utf8');
const production = await readFile(new URL('../lib/model-provider-production-runtime.mjs', import.meta.url), 'utf8');

assert.match(router, /startsWith\(LOCAL_MODEL_PREFIX\)/);
assert.match(router, /defaultProvider:\s*'nvidia'/);
assert.match(runtime, /defaultProvider:\s*router\.defaultProvider/);
assert.match(production, /defaultProvider:\s*runtime\.defaultProvider/);
assert.doesNotMatch(runtime, /approvalGranted\s*:\s*true/);
assert.doesNotMatch(runtime, /tool[_-]?permission/i);
assert.doesNotMatch(runtime, /github.*write/i);
assert.doesNotMatch(runtime, /gmail.*send/i);
assert.doesNotMatch(runtime, /canva.*write/i);

console.log('local provider safety parity tests passed');
