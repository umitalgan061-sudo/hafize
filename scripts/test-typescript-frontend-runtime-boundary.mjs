import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const index = await readFile(join(root, 'public/index.html'), 'utf8');
const vite = await readFile(join(root, 'vite.config.ts'), 'utf8');
const sw = await readFile(join(root, 'public/sw-policy.js'), 'utf8');
const app = await readFile(join(root, 'public/typed/app-shell.ts'), 'utf8');

const migrated = [
  'chat-composer-features',
  'chat-history-search',
  'chat-history-management',
  'hands-free',
  'hands-free-background-guard',
  'settings-privacy',
  'workspace-navigation'
];

for (const name of migrated) {
  assert(existsSync(join(root, 'public/typed', name + '.ts')), 'missing TS source: ' + name);
  assert(!existsSync(join(root, 'public', name + '.js')), 'legacy JS remains: ' + name);
  assert(index.includes('/typed-build/' + name + '.js'), 'HTML entry missing: ' + name);
  assert(vite.includes(name), 'Vite entry missing: ' + name);
  assert(sw.includes('/typed-build/' + name + '.js'), 'PWA cache entry missing: ' + name);
}

const coreModules = [
  'hafize-sse',
  'hafize-storage',
  'hafize-async',
  'hafize-stream-state'
];

for (const name of coreModules) {
  assert(existsSync(join(root, 'public/typed', name + '.ts')), 'missing typed core module: ' + name);
}

assert(app.includes("import { hafizeApi } from './hafize-api.ts';"), 'app shell bypasses typed JSON API client');
assert(app.includes("import { HafizeSseClient"), 'app shell bypasses typed SSE client');
assert(app.includes('createHafizeStreamController'), 'stream state controller is not integrated');
assert(app.includes('streamState.begin()'), 'stream begin state not published');
assert(app.includes('streamState.complete('), 'stream complete state not published');
assert(app.includes('streamState.fail('), 'stream failure state not published');
assert(!app.includes('REQUEST_TIMEOUT_MS'), 'obsolete local request timeout constant remains');
assert(!app.includes('function parseSseBlock'), 'duplicate SSE parser remains in app shell');

const sse = await readFile(join(root, 'public/typed/hafize-sse.ts'), 'utf8');
assert(sse.includes('SSE_FRAME_TOO_LARGE'), 'frame guard missing');
assert(sse.includes('SSE_BUFFER_TOO_LARGE'), 'buffer guard missing');
assert(sse.includes('SSE_EVENT_LIMIT'), 'event guard missing');
assert(sse.includes('reader.cancel(error)'), 'reader cancellation missing');
assert(sse.includes('reader.releaseLock()'), 'reader release missing');
assert(sse.includes('X-Hafize-Trace-Id'), 'trace-id handling missing');
assert(!/fetch.*retry|retry.*fetch/i.test(sse), 'unsafe SSE retry pattern detected');

const storage = await readFile(join(root, 'public/typed/hafize-storage.ts'), 'utf8');
assert(storage.includes('maxValueBytes'), 'storage value bounds missing');
assert(storage.includes('maxWriteBytes'), 'storage write bounds missing');
assert(storage.includes('TextEncoder'), 'storage byte-size check missing');
assert(storage.includes('STORAGE_SERIALIZE_FAILED'), 'storage serialize failure missing');
assert(storage.includes('STORAGE_WRITE_FAILED'), 'storage write failure missing');

const asyncCore = await readFile(join(root, 'public/typed/hafize-async.ts'), 'utf8');
assert(asyncCore.includes('HafizeAsyncTimeoutError'), 'async timeout type missing');
assert(asyncCore.includes('HafizeAsyncCancelledError'), 'async cancellation type missing');
assert(asyncCore.includes('operationId'), 'async operation id missing');
assert(asyncCore.includes('controller.abort'), 'async abort path missing');

const streamState = await readFile(join(root, 'public/typed/hafize-stream-state.ts'), 'utf8');
for (const phase of ['connecting', 'streaming', 'completed', 'aborted', 'failed']) {
  assert(streamState.includes("'" + phase + "'"), 'stream phase missing: ' + phase);
}
assert(streamState.includes('formatStreamDuration'), 'stream duration formatter missing');
assert(streamState.includes('formatStreamBytes'), 'stream byte formatter missing');

const forbidden = /NVIDIA_API_KEY|CLIENT_SECRET|PRIVATE_KEY|-----BEGIN .*PRIVATE KEY-----/i;
for (const file of [
  'public/typed/hafize-sse.ts',
  'public/typed/hafize-storage.ts',
  'public/typed/hafize-async.ts',
  'public/typed/hafize-stream-state.ts'
]) {
  const source = await readFile(join(root, file), 'utf8');
  assert(!forbidden.test(source), 'credential-like content found in ' + file);
}

console.log('Frontend runtime boundary: PASS');