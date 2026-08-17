import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const writerPath = fileURLToPath(new URL('../lib/sse-node-writer.mjs', import.meta.url));
const routePath = fileURLToPath(new URL('../lib/model-provider-node-http-route.mjs', import.meta.url));
const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/SSE_SERVER_BACKPRESSURE.md', import.meta.url));

const [writer, route, server, doc] = await Promise.all([
  readFile(writerPath, 'utf8'),
  readFile(routePath, 'utf8'),
  readFile(serverPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [writerPath, routePath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax failed`);
}

assert.match(route, /createSseNodeWriter/);
assert.match(route, /await writer\.pipe\(result\.body\)/);
assert.match(route, /await writer\.writeError\('STREAM_INTERRUPTED'\)/);
assert.match(route, /writer\.end\(\)/);
assert.equal(route.includes('for await (const chunk of result.body)'), false);
assert.equal(route.includes('response.write(chunk)'), false);

assert.match(writer, /response\.once\('drain'/);
assert.match(writer, /response\.once\('close'/);
assert.match(writer, /response\.once\('error'/);
assert.match(writer, /signal\?\.addEventListener\?\('abort'/);
assert.match(writer, /SSE_OUTPUT_CHUNK_TOO_LARGE/);
assert.match(writer, /SSE_OUTPUT_WRITE_CONCURRENT/);
assert.match(writer, /256 \* 1024/);

for (const forbidden of [
  /\bfetch\s*\(/, /\bWebSocket\b/, /\bEventSource\b/, /sendBeacon/,
  /localStorage/, /sessionStorage/, /indexedDB/i, /document\.cookie/,
  /navigator\.clipboard/, /child_process/, /\bexec\s*\(/, /\bspawn\s*\(/,
  /shell\s*:\s*true/i, /Authorization/i, /GITHUB_TOKEN/, /NVIDIA_API_KEY/
]) {
  assert.equal(forbidden.test(writer), false, `writer must not expose side effect surface: ${forbidden}`);
}

assert.match(server, /'\/api\/agent\/run'/);
assert.match(server, /'\/api\/chat'/);
assert.match(doc, /backpressure/i);
assert.match(doc, /drain/i);
assert.match(doc, /256 KiB/i);
assert.match(doc, /disconnect/i);
assert.match(doc, /\/api\/chat/);

console.log('sse node writer integration tests passed');
