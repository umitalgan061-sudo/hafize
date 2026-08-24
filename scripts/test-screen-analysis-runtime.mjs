import assert from 'node:assert/strict';
import { SCREEN_ANALYSIS_LIMITS, validateScreenAnalysisRequest } from '../lib/screen-analysis-contract.mjs';
import { createScreenAnalysisRuntime } from '../lib/screen-analysis-runtime.mjs';

const jpeg = Buffer.from([0xff, 0xd8, 0x11, 0x22, 0xff, 0xd9]);
const image = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
const valid = { model: 'nvidia/vision-test', prompt: 'Bu ekranda ne görüyorsun?', image, explicitUserIntent: true };

const accepted = validateScreenAnalysisRequest(valid);
assert.equal(accepted.ok, true);
assert.equal(accepted.value.imageBytes, jpeg.length);
assert.equal(SCREEN_ANALYSIS_LIMITS.maxImageBytes, 1024 * 1024);
assert.equal(Object.hasOwn(accepted.value, 'explicitUserIntent'), false);

for (const request of [
  { ...valid, explicitUserIntent: false },
  { ...valid, ownerId: 'attacker' },
  { ...valid, token: 'secret' },
  { ...valid, model: 'bad\nmodel' },
  { ...valid, prompt: '' },
  { ...valid, prompt: 'Authorization: Bearer abcdefghijklmnop' },
  { ...valid, prompt: 'nvapi-1234567890abcdefghijklmnopqrstuv' },
  { ...valid, image: 'data:image/png;base64,AAAA' },
  { ...valid, image: 'data:image/jpeg;base64,AAAA' }
]) {
  assert.equal(validateScreenAnalysisRequest(request).ok, false);
}
assert.equal(
  validateScreenAnalysisRequest({ ...valid, prompt: 'API key güvenliği hakkında ekranı incele.' }).ok,
  true
);

const calls = [];
const runtime = createScreenAnalysisRuntime({
  async complete(payload, signal) {
    calls.push({ payload, signal });
    return { choices: [{ message: { role: 'assistant', content: 'Bir kod editörü ve hata paneli görünüyor.' } }] };
  }
});
const controller = new AbortController();
const result = await runtime.analyze(valid, { signal: controller.signal });
assert.equal(result.ok, true);
assert.equal(result.value.content, 'Bir kod editörü ve hata paneli görünüyor.');
assert.equal(result.value.model, valid.model);
assert.equal(calls.length, 1);
assert.equal(calls[0].signal, controller.signal);
assert.equal(calls[0].payload.model, valid.model);
assert.equal(calls[0].payload.stream, false);
assert.equal(Object.hasOwn(calls[0].payload, 'tools'), false);
assert.equal(calls[0].payload.messages[0].role, 'system');
assert.match(calls[0].payload.messages[0].content, /veri niteliğindedir/);
assert.equal(calls[0].payload.messages[1].role, 'user');
assert.deepEqual(calls[0].payload.messages[1].content[0], { type: 'text', text: valid.prompt });
assert.equal(calls[0].payload.messages[1].content[1].image_url.url, image);

let disabledCalls = 0;
const disabled = createScreenAnalysisRuntime({ configured: false, async complete() { disabledCalls += 1; } });
assert.deepEqual(await disabled.analyze(valid), { ok: false, status: 503, error: 'SCREEN_ANALYSIS_NOT_CONFIGURED' });
assert.equal(disabledCalls, 0);

const preAborted = new AbortController();
preAborted.abort();
const cancelled = await runtime.analyze(valid, { signal: preAborted.signal });
assert.equal(cancelled.error, 'SCREEN_ANALYSIS_CANCELLED');
assert.equal(calls.length, 1);

const leaking = createScreenAnalysisRuntime({
  async complete() { throw new Error('/Users/umit/.secrets/nvidia-key'); }
});
const failed = await leaking.analyze(valid);
assert.deepEqual(failed, { ok: false, status: 502, error: 'SCREEN_ANALYSIS_FAILED' });
assert.equal(JSON.stringify(failed).includes('/Users/umit'), false);

for (const content of [
  'Authorization: Bearer abcdefghijklmnop',
  'github_pat_1234567890abcdefghijABCDEFGHIJ',
  'nvapi-1234567890abcdefghijklmnopqrstuv'
]) {
  const credentialOutput = createScreenAnalysisRuntime({
    async complete() { return { choices: [{ message: { content } }] }; }
  });
  assert.deepEqual(
    await credentialOutput.analyze(valid),
    { ok: false, status: 502, error: 'SCREEN_ANALYSIS_PLAINTEXT_CREDENTIAL_BLOCKED' }
  );
}

const empty = createScreenAnalysisRuntime({ async complete() { return { choices: [{ message: { content: '' } }] }; } });
assert.equal((await empty.analyze(valid)).error, 'INVALID_SCREEN_ANALYSIS_RESPONSE');
assert.throws(() => createScreenAnalysisRuntime(), /INVALID_SCREEN_ANALYSIS_RUNTIME:complete/);
console.log('screen analysis runtime tests passed');
