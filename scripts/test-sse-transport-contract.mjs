import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sse = await readFile(join(root, 'public/typed/hafize-sse.ts'), 'utf8');
const app = await readFile(join(root, 'public/typed/app-shell.ts'), 'utf8');

for (const token of [
  'HafizeSseEvent', 'HafizeSseStats', 'HafizeSseError', 'parseSseEventBlock',
  'consumeSseResponse', 'HafizeSseClient', 'SSE_FRAME_TOO_LARGE',
  'SSE_BUFFER_TOO_LARGE', 'SSE_EVENT_LIMIT', 'SSE_ABORTED', 'SSE_BODY_MISSING',
  'X-Hafize-Trace-Id'
]) assert(sse.includes(token), 'SSE transport contract is missing: ' + token);

assert(sse.includes('TextDecoder'), 'SSE must decode UTF-8 streams explicitly');
assert(sse.includes('reader.cancel(error)'), 'SSE must cancel the reader on failure');
assert(sse.includes('reader.releaseLock()'), 'SSE must release the reader lock');
assert(sse.includes('data.join('), 'SSE must support multiple data fields');
assert(sse.includes("data === '[DONE]'"), 'SSE must honor the completion sentinel');
assert(sse.includes('timeoutMs'), 'SSE transport must expose a timeout');
assert(sse.includes('parentSignal'), 'SSE transport must support parent cancellation');
assert(!sse.includes('HafizeApiError'), 'SSE transport must not depend on removed legacy error type');
assert(!/retry.*fetch|fetch.*retry/i.test(sse), 'SSE POST transport must not add unsafe automatic retries');

assert(app.includes('HafizeSseClient'), 'app-shell must use the typed SSE client');
assert(app.includes('hafizeSse.stream'), 'chat must consume the centralized SSE transport');
assert(app.includes('streamState.begin()'), 'chat must publish stream start state');
assert(app.includes('streamState.complete('), 'chat must publish stream completion state');
assert(app.includes('streamState.fail('), 'chat must publish stream failure state');
assert(!app.includes('function parseSseBlock'), 'app-shell must not contain a second SSE parser');
assert(!/fetch\([^\n]*\/api\/(chat|agent\/run)/.test(app), 'chat streaming must not bypass the typed SSE transport');

console.log('Typed SSE transport contract: PASS');