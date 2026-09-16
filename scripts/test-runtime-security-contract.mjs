import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const config = readFileSync(new URL('../lib/runtime-config.ts', import.meta.url), 'utf8');
const failure = readFileSync(new URL('../lib/request-failure.ts', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../lib/server-auth.ts', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server-runtime.mjs', import.meta.url), 'utf8');

assert.match(config, /startsWith\('https:\/\/'\)/);
assert.match(failure, /NVIDIA_CHAT_ERROR/);
assert.match(failure, /STREAM_INTERRUPTED/);
assert.match(auth, /timingSafeEqual/);
assert.match(auth, /MIN_TOKEN_LENGTH = 32/);
assert.match(server, /MAX_BODY_BYTES/);
assert.match(server, /X-Content-Type-Options/);
assert.match(server, /pathname === '\/' \|\| pathname === '\/index.html'/);
console.log('runtime security contract: ok');
