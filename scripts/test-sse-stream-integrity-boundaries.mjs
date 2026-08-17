import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const api = require('../public/chat-run-controller.js');
const sourcePath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const source = await readFile(sourcePath, 'utf8');

assert.deepEqual(api.SSE_STREAM_PATHS, ['/api/chat', '/api/agent/run']);
assert.equal(Object.isFrozen(api.SSE_STREAM_PATHS), true);
assert.equal(api.MAX_SSE_PENDING_CHARS, 262144);

const origin = 'https://hafize.test';
for (const path of ['/api/chat', '/api/agent/run']) {
  assert.equal(api.shouldGuardSseRequest(path, { method: 'POST' }, origin), true);
}
for (const path of [
  '/api/models',
  '/api/agents',
  '/api/memory',
  '/api/schedules',
  '/api/github/write/prepare',
  '/api/github/write/execute',
  '/api/connectors/gmail/status',
  '/api/connectors/canva/status',
  '/api/screen-analysis',
  '/api/chat/',
  '/api/agent/run/'
]) {
  assert.equal(api.shouldGuardSseRequest(path, { method: 'POST' }, origin), false, `${path} must remain outside SSE guard`);
}

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /Authorization/i,
  /Bearer\s+/i,
  /GITHUB_TOKEN/,
  /NVIDIA_API_KEY/,
  /CANVA_/,
  /GOOGLE_CLIENT_SECRET/,
  /shell\s*=\s*true/i,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `SSE integrity layer must not expose forbidden surface: ${forbidden}`);
}

assert.match(source, /SSE_STREAM_PATHS = Object\.freeze\(\['\/api\/chat', '\/api\/agent\/run'\]\)/);
assert.match(source, /MAX_SSE_PENDING_CHARS = 256 \* 1024/);
assert.match(source, /parsed\.origin === origin/);
assert.match(source, /!parsed\.search && !parsed\.hash/);
assert.match(source, /type\.split\(';', 1\)\[0\]\.trim\(\) === 'text\/event-stream'/);
assert.match(source, /headers\.set\('Cache-Control', 'no-store'\)/);
assert.match(source, /api\.installSseIntegrity\(root\)/);
assert.match(source, /if \(!shouldGuard \|\| !isEventStreamResponse\(response\)\) return response/);
assert.match(source, /originalFetch\(input, init\)/, 'input/init must be forwarded unchanged');

{
  const normalizer = api.createSseFrameNormalizer();
  const largeButValid = `data: ${'x'.repeat(api.MAX_SSE_PENDING_CHARS - 10)}`;
  assert.equal(normalizer.push(largeButValid).length, 0);
  assert.equal(normalizer.finish().length, 1);
}

{
  const normalizer = api.createSseFrameNormalizer();
  assert.throws(
    () => normalizer.push('x'.repeat(api.MAX_SSE_PENDING_CHARS + 1)),
    /SSE_FRAME_TOO_LARGE/
  );
}

console.log('SSE stream integrity boundary tests passed');
