import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
assert.match(source, /node:process\.version|nodeMajor/);
assert.match(source, /readRuntimeConfig/);
assert.match(source, /validateRuntimeConfig/);
assert.match(source, /NODE_VERSION_TOO_OLD/);
assert.match(source, /server-runtime\.mjs/);
assert.ok(!source.includes('NVIDIA_API_KEY='), 'secrets must stay in environment access');
assert.ok(!source.includes('client_secret'), 'OAuth secrets must not enter the bootstrap');
console.log('Node runtime contract: ok');
