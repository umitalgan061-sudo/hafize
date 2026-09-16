import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../lib/runtime-config.ts', import.meta.url), 'utf8');
assert.match(source, /export type RuntimeConfig/);
assert.match(source, /readRuntimeConfig/);
assert.match(source, /validateRuntimeConfig/);
assert.match(source, /NIM_BASE_URL/);
assert.match(source, /HAFIZE_UPSTREAM_TIMEOUT_MS/);
assert.match(source, /HAFIZE_MAX_BODY_BYTES/);
assert.match(source, /NODE_VERSION_TOO_OLD/);
assert.match(source, /NIM_BASE_URL_MUST_USE_HTTPS/);
assert.ok(source.includes('Object.freeze'), 'runtime config should expose immutable snapshots');
console.log('runtime config contract: ok');
