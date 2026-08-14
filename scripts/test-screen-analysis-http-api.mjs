import assert from 'node:assert/strict';
import { createScreenAnalysisHttpApi } from '../lib/screen-analysis-http-api.mjs';

const jpeg = Buffer.from([0xff, 0xd8, 0x33, 0x44, 0xff, 0xd9]);
const requestBody = {
  model: 'nvidia/vision-test',
  prompt: 'Bu ekrandaki hatayı özetle.',
  image: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
  explicitUserIntent: true
};

const calls = [];
const api = createScreenAnalysisHttpApi({
  runtime: {
    async analyze(body, options) {
      calls.push({ body, options });
      return { ok: true, status: 200, value: { content: 'Bir hata paneli görünüyor.', model: body.model, imageBytes: 6 } };
    }
  },
  async readJson(request) { return request.body; }
});

assert.deepEqual(await api.handle({ method: 'GET', pathname: '/other' }), { matched: false });
const wrongMethod = await api.handle({ method: 'GET', pathname: '/api/screen-analysis' });
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.headers.Allow, 'POST');
assert.equal(wrongMethod.headers['Cache-Control'], 'no-store');
assert.equal(calls.length, 0);

const controller = new AbortController();
const success = await api.handle({
  request: { body: requestBody },
  method: 'POST',
  pathname: '/api/screen-analysis',
  signal: controller.signal
});
assert.equal(success.status, 200);
assert.deepEqual(success.body, { content: 'Bir hata paneli görünüyor.', model: 'nvidia/vision-test' });
assert.equal(success.headers['Cache-Control'], 'no-store');
assert.equal(calls.length, 1);
assert.equal(calls[0].body, requestBody);
assert.equal(calls[0].options.signal, controller.signal);
assert.equal(JSON.stringify(success).includes('imageBytes'), false);
assert.equal(JSON.stringify(success).includes(requestBody.image), false);

const blockedApi = createScreenAnalysisHttpApi({
  runtime: {
    async analyze() {
      return { ok: false, status: 400, error: 'INVALID_SCREEN_ANALYSIS_REQUEST', reason: 'explicit_user_intent_required' };
    }
  },
  async readJson() { return requestBody; }
});
const blocked = await blockedApi.handle({ request: {}, method: 'POST', pathname: '/api/screen-analysis' });
assert.deepEqual(blocked.body, {
  error: 'INVALID_SCREEN_ANALYSIS_REQUEST',
  reason: 'explicit_user_intent_required'
});

for (const [error, expectedStatus, expectedError] of [
  [Object.assign(new Error('BODY_TOO_LARGE'), { message: 'BODY_TOO_LARGE' }), 413, 'BODY_TOO_LARGE'],
  [new SyntaxError('bad json /tmp/private'), 400, 'INVALID_JSON'],
  [new Error('/tmp/private'), 400, 'INVALID_SCREEN_ANALYSIS_REQUEST']
]) {
  const failingApi = createScreenAnalysisHttpApi({
    runtime: { async analyze() { throw new Error('should not run'); } },
    async readJson() { throw error; }
  });
  const response = await failingApi.handle({ request: {}, method: 'POST', pathname: '/api/screen-analysis' });
  assert.equal(response.status, expectedStatus);
  assert.equal(response.body.error, expectedError);
  assert.equal(JSON.stringify(response).includes('/tmp/private'), false);
}

assert.throws(() => createScreenAnalysisHttpApi({ readJson() {} }), /runtime/);
assert.throws(() => createScreenAnalysisHttpApi({ runtime: { analyze() {} } }), /readJson/);
console.log('screen analysis HTTP API tests passed');
