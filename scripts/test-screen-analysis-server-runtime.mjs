import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import {
  SCREEN_ANALYSIS_MAX_BODY_BYTES,
  createScreenAnalysisServerRuntime
} from '../lib/screen-analysis-server-runtime.mjs';

function requestFrom(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  return Readable.from([buffer]);
}

const jpeg = Buffer.from([0xff, 0xd8, 0x10, 0xff, 0xd9]);
const image = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
const completions = [];
const runtime = createScreenAnalysisServerRuntime({
  async complete(payload, signal) {
    completions.push({ payload, signal });
    return { choices: [{ message: { content: 'Ekranda bir hata paneli görünüyor.' } }] };
  }
});
assert.equal(runtime.configured, true);
assert.equal(runtime.maxBodyBytes, SCREEN_ANALYSIS_MAX_BODY_BYTES);
assert.equal(runtime.maxBodyBytes > 1024 * 1024, true);
assert.equal(runtime.maxBodyBytes <= 2 * 1024 * 1024, true);

const controller = new AbortController();
const response = await runtime.handle({
  request: requestFrom({ model: 'vision', prompt: 'Bak', image, explicitUserIntent: true }),
  method: 'POST',
  pathname: '/api/screen-analysis',
  signal: controller.signal
});
assert.equal(response.status, 200);
assert.equal(response.headers['Cache-Control'], 'no-store');
assert.deepEqual(response.body, { content: 'Ekranda bir hata paneli görünüyor.', model: 'vision' });
assert.equal(completions.length, 1);
assert.equal(completions[0].signal, controller.signal);
assert.equal(Object.hasOwn(completions[0].payload, 'tools'), false);

let oversizeCompletion = 0;
const bounded = createScreenAnalysisServerRuntime({
  maxBodyBytes: 1024 * 1024,
  async complete() { oversizeCompletion += 1; }
});
const oversized = await bounded.handle({
  request: requestFrom(Buffer.alloc(1024 * 1024 + 1, 0x61)),
  method: 'POST',
  pathname: '/api/screen-analysis'
});
assert.equal(oversized.status, 413);
assert.deepEqual(oversized.body, { error: 'BODY_TOO_LARGE' });
assert.equal(oversizeCompletion, 0);

const disabled = createScreenAnalysisServerRuntime({ configured: false, async complete() {} });
const unavailable = await disabled.handle({
  request: requestFrom({ model: 'vision', prompt: 'Bak', image, explicitUserIntent: true }),
  method: 'POST',
  pathname: '/api/screen-analysis'
});
assert.equal(unavailable.status, 503);
assert.deepEqual(unavailable.body, { error: 'SCREEN_ANALYSIS_NOT_CONFIGURED' });

const unmatched = await runtime.handle({ request: requestFrom({}), method: 'POST', pathname: '/api/chat' });
assert.deepEqual(unmatched, { matched: false });
assert.throws(
  () => createScreenAnalysisServerRuntime({ maxBodyBytes: 3 * 1024 * 1024, async complete() {} }),
  /maxBodyBytes/
);
console.log('screen analysis server runtime tests passed');
