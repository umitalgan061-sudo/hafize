import assert from 'node:assert/strict';
import { createScreenAnalysisHttpApi } from '../lib/screen-analysis-http-api.mjs';

{
  let runtimeCalled = false;
  const api = createScreenAnalysisHttpApi({
    runtime: { async analyze() { runtimeCalled = true; return { ok: true, value: { content: 'x', model: 'm' } }; } },
    readJson: async () => ({})
  });
  const result = await api.handle({ method: 'POST', pathname: '/other' });
  assert.deepEqual(result, { matched: false });
  assert.equal(runtimeCalled, false);
}

{
  let readCalled = false;
  const api = createScreenAnalysisHttpApi({
    runtime: { async analyze() { throw new Error('must not run'); } },
    readJson: async () => { readCalled = true; return {}; }
  });
  const result = await api.handle({ method: 'GET', pathname: '/api/screen-analysis' });
  assert.equal(result.matched, true);
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'POST');
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.body.error, 'METHOD_NOT_ALLOWED');
  assert.equal(readCalled, false);
}

{
  const signal = new AbortController().signal;
  const body = { explicitUserIntent: true, prompt: 'Inspect', model: 'meta/vision', image: 'data:image/jpeg;base64,abc' };
  let seenBody = null;
  let seenSignal = null;
  const api = createScreenAnalysisHttpApi({
    runtime: {
      async analyze(value, options) {
        seenBody = value;
        seenSignal = options.signal;
        return { ok: true, value: { content: 'safe result', model: 'meta/vision' } };
      }
    },
    readJson: async () => body
  });
  const result = await api.handle({ request: {}, method: 'POST', pathname: '/api/screen-analysis', signal });
  assert.equal(seenBody, body);
  assert.equal(seenSignal, signal, 'request cancellation signal reaches screen-analysis runtime');
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(result.body, { content: 'safe result', model: 'meta/vision' });
}

{
  const api = createScreenAnalysisHttpApi({
    runtime: { async analyze() { throw new Error('must not run'); } },
    readJson: async () => { throw new Error('BODY_TOO_LARGE'); }
  });
  const result = await api.handle({ request: {}, method: 'POST', pathname: '/api/screen-analysis' });
  assert.equal(result.status, 413);
  assert.equal(result.body.error, 'BODY_TOO_LARGE');
  assert.equal(result.headers['Cache-Control'], 'no-store');
}

{
  const api = createScreenAnalysisHttpApi({
    runtime: { async analyze() { throw new Error('must not run'); } },
    readJson: async () => { throw new SyntaxError('bad json'); }
  });
  const result = await api.handle({ request: {}, method: 'POST', pathname: '/api/screen-analysis' });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_JSON');
  assert.equal(result.headers['Cache-Control'], 'no-store');
}

{
  const api = createScreenAnalysisHttpApi({
    runtime: { async analyze() { return { ok: false, status: 403, error: 'SCREEN_ANALYSIS_ORIGIN_DENIED', reason: 'origin' }; } },
    readJson: async () => ({})
  });
  const result = await api.handle({ request: {}, method: 'POST', pathname: '/api/screen-analysis' });
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'SCREEN_ANALYSIS_ORIGIN_DENIED');
  assert.equal(result.body.reason, 'origin');
  assert.equal(result.headers['Cache-Control'], 'no-store');
}

assert.throws(
  () => createScreenAnalysisHttpApi({ runtime: null, readJson: async () => ({}) }),
  /INVALID_SCREEN_ANALYSIS_HTTP_API:runtime/
);
assert.throws(
  () => createScreenAnalysisHttpApi({ runtime: { analyze() {} }, readJson: null }),
  /INVALID_SCREEN_ANALYSIS_HTTP_API:readJson/
);

console.log('screen analysis HTTP cancellation wiring tests passed');
